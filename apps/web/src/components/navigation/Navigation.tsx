'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { User, LogIn, LogOut, Menu, X, Settings, Search, MessageSquare } from 'lucide-react';
import { identifyUser, trackUserSignOut } from '@/lib/posthog';
import { useSession, signOut } from 'next-auth/react';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { TimeControlModal } from '@/components/game/TimeControlModal';
import { GuestSettings } from '@/components/guest/GuestSettings';

interface NavigationUser {
  id: string;
  handle: string;
  email: string;
}

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<NavigationUser | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [playDropdownOpen, setPlayDropdownOpen] = useState(false);
  const [tournamentsDropdownOpen, setTournamentsDropdownOpen] = useState(false);
  const [mobileTournamentsOpen, setMobileTournamentsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  type SearchBuckets = {
    discussions: Array<{ handle: string; userId: string }>;
    following: Array<{ handle: string; userId: string }>;
    players: Array<{ handle: string }>;
  };
  const [searchResults, setSearchResults] = useState<SearchBuckets>({ discussions: [], following: [], players: [] });
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [timeControlModalOpen, setTimeControlModalOpen] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('bullet');
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    // Flatten for keyboard navigation
    const flat: Array<{ type: keyof SearchBuckets; handle: string; userId?: string }> = [
      ...searchResults.discussions.map(r => ({ type: 'discussions' as const, handle: r.handle, userId: r.userId })),
      ...searchResults.following.map(r => ({ type: 'following' as const, handle: r.handle, userId: r.userId })),
      ...searchResults.players.map(r => ({ type: 'players' as const, handle: r.handle })),
    ];

    if (selectedIndex >= 0 && selectedIndex < flat.length) {
      window.location.href = `/profile/${flat[selectedIndex].handle}`;
      setSearchQuery('');
      setSearchExpanded(false);
      setShowResults(false);
      setSelectedIndex(-1);
    } else if (searchQuery.trim()) {
      // Otherwise, navigate to the typed query
      window.location.href = `/profile/${searchQuery.trim()}`;
      setSearchQuery('');
      setSearchExpanded(false);
      setShowResults(false);
      setSelectedIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const flatLen = searchResults.discussions.length + searchResults.following.length + searchResults.players.length;
    if (!showResults || flatLen === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatLen - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowResults(false);
      setSelectedIndex(-1);
    }
  };

  const searchAll = async (query: string) => {
    if (query.length < 3) {
      setSearchResults({ discussions: [], following: [], players: [] });
      setShowResults(false);
      return;
    }

    try {
      const [playersRes, convRes, follRes] = await Promise.all([
        fetch(`/api/user/search?q=${encodeURIComponent(query)}`),
        fetch('/api/messages/conversations'),
        fetch('/api/follow/list'),
      ]);

      const players: Array<{ handle: string }> = playersRes.ok ? await playersRes.json() : [];
      const convJson = convRes.ok ? await convRes.json() : { conversations: [] };
      const conversations: Array<{ user: { id: string; handle: string } }>= convJson.conversations || [];
      const followingJson = follRes.ok ? await follRes.json() : { following: [] };
      const following: Array<{ id: string; handle: string }> = followingJson.following || [];

      const q = query.toLowerCase();
      const discussions = conversations
        .filter(c => c.user.handle.toLowerCase().includes(q))
        .slice(0, 5)
        .map(c => ({ handle: c.user.handle, userId: c.user.id }));
      const followingRes = following
        .filter(f => f.handle.toLowerCase().includes(q))
        .slice(0, 5)
        .map(f => ({ handle: f.handle, userId: f.id }));
      const playersResSlice = players.slice(0, 10);

      setSearchResults({ discussions, following: followingRes, players: playersResSlice });
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchAll(searchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update user state from session
  useEffect(() => {
    if (session?.user) {
      const sessionUser = session.user as any;
      const userData = {
        id: sessionUser.id,
        handle: sessionUser.handle || 'Guest',
        email: sessionUser.email || '',
      };
      setUser(userData);

      // Identify user in PostHog
      if (sessionUser.id) {
        identifyUser(sessionUser.id, {
          handle: sessionUser.handle,
          email: sessionUser.email
        });
      }
    } else {
      setUser(null);
    }
  }, [session]);

  const handleLogout = async () => {
    try {
      // Track logout
      trackUserSignOut();

      // First, clear the auth-token cookie via API
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to clear auth-token cookie:', error);
        // Continue with logout even if this fails
      }

      // Then, clear NextAuth session
      await signOut({ 
        callbackUrl: '/',
        redirect: true 
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if NextAuth logout fails, try to redirect
      window.location.href = '/';
    }
  };

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/play', label: 'Play' },
    { href: '/games/live', label: 'Watch' },
    { href: '/tournaments', label: 'Tournaments' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/teams', label: 'Teams' },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
    <nav className="bg-[#2a2926]/80 light:bg-white/90 backdrop-blur-md border-b border-[#3e3a33] light:border-[#d4caba] sticky top-0 z-50 shadow-[0_8px_24px_rgba(0,0,0,0.35)] light:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <div className="w-full px-2 sm:px-3 md:px-3 lg:px-4">
        <div className="flex items-center h-16">
          {/* Logo */}
            <Link href="/" className="flex items-center group -ml-8 max-h-16 overflow-hidden">
            <Image
              src="/logo.png"
              alt="Chess960"
              width={140}
              height={117}
              className="mt-3 transition-all duration-200 brightness-100 group-hover:brightness-90"
            />
            <span className="text-2xl sm:text-3xl font-normal italic bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent -ml-10 transition-all duration-200" style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.01em' }}>
              <span className="text-3xl sm:text-4xl">C</span>hess960
            </span>
          </Link>

          {/* Center Navigation Links */}
          <div className="hidden lg:flex items-center justify-center flex-1 space-x-1">
            {/* Play Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setPlayDropdownOpen(true)}
              onMouseLeave={() => setPlayDropdownOpen(false)}
            >
              <button
                className="px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-orange-200 light:hover:text-orange-400 rounded-lg hover:bg-[#2f2b27] light:hover:bg-[#f0ebe0] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-all duration-200 font-medium"
              >
                Play
              </button>

              {playDropdownOpen && (
                <div className="absolute top-full left-0 w-48 bg-[#2a2720] light:bg-[#f5f1ea] rounded-lg shadow-xl border border-[#474239] light:border-[#d4caba] z-50">
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setSelectedSpeed('bullet');
                        setTimeControlModalOpen(true);
                        setPlayDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#f0ebe0] transition-colors"
                    >
                      Play Bullet
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSpeed('blitz');
                        setTimeControlModalOpen(true);
                        setPlayDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#f0ebe0] transition-colors"
                    >
                      Play Blitz
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSpeed('rapid');
                        setTimeControlModalOpen(true);
                        setPlayDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#f0ebe0] transition-colors"
                    >
                      Play Rapid
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSpeed('classical');
                        setTimeControlModalOpen(true);
                        setPlayDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#f0ebe0] transition-colors"
                    >
                      Play Classical
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tournaments Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setTournamentsDropdownOpen(true)}
              onMouseLeave={() => setTournamentsDropdownOpen(false)}
            >
              <button
                className="px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-orange-200 light:hover:text-orange-400 rounded-lg hover:bg-[#2f2b27] light:hover:bg-[#f0ebe0] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-all duration-200 font-medium"
              >
                Tournaments
              </button>

              {tournamentsDropdownOpen && (
                <div className="absolute left-0 mt-0 pt-2 w-40">
                  <div className="bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg shadow-lg py-1">
                    <Link
                      href="/tournaments/arena"
                      className="block px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] transition-colors"
                    >
                      Arena
                    </Link>
                    <Link
                      href="/tournaments/team"
                      className="block px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] transition-colors"
                    >
                      Team
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <Link
              href="/leaderboard"
              className="px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-orange-200 light:hover:text-orange-400 rounded-lg hover:bg-[#2f2b27] light:hover:bg-[#f0ebe0] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-all duration-200 font-medium"
            >
              Leaderboard
            </Link>

            {/* Donate */}
            <Link
              href="/donate"
              className="px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-orange-200 light:hover:text-orange-400 rounded-lg hover:bg-[#2f2b27] light:hover:bg-[#f0ebe0] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-all duration-200 font-medium"
            >
              Donate
            </Link>

          </div>

          {/* Right Side: Search + Notifications + User Menu */}
          <div className="hidden lg:flex items-center space-x-4">
            {/* Search */}
            <div
              className="relative"
              onMouseEnter={() => setSearchExpanded(true)}
              onMouseLeave={() => {
                if (!searchQuery) {
                  setSearchExpanded(false);
                  setShowResults(false);
                }
              }}
            >
              {searchExpanded && (
                <form onSubmit={handleSearch} className="absolute right-10 top-1/2 -translate-y-1/2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      setTimeout(() => {
                        setSearchExpanded(false);
                        setShowResults(false);
                        setSearchQuery('');
                        setSelectedIndex(-1);
                      }, 200);
                    }}
                    placeholder="Search user..."
                    autoFocus
                    className="w-48 px-3 py-2 bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#9a958e] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent text-sm"
                  />
                </form>
              )}
              <button
                className="p-2 text-[#c1b9ad] hover:text-orange-200 transition-colors"
              >
                <Search className="h-5 w-5" />
              </button>

              {showResults && (searchResults.discussions.length + searchResults.following.length + searchResults.players.length) > 0 && (
                <div className="absolute right-10 mt-2 w-48 bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                  {(['discussions','following','players'] as const).map((section) => {
                    const list = searchResults[section];
                    if (list.length === 0) return null;
                    const startIndexOffset = section === 'discussions' ? 0 : section === 'following' ? searchResults.discussions.length : searchResults.discussions.length + searchResults.following.length;
                    return (
                      <div key={section}>
                        <div className="px-4 py-1 text-[10px] uppercase tracking-wide text-[#a0958a] light:text-[#5a5449]">{section}</div>
                        {list.map((result, idx) => {
                          const index = startIndexOffset + idx;
                          return (
                            <Link
                              key={`${section}-${result.handle}-${idx}`}
                              href={`/profile/${result.handle}`}
                              className={`block px-4 py-2 text-white transition-colors ${
                                index === selectedIndex ? 'bg-orange-300/20 border-l-2 border-orange-300' : 'hover:bg-[#33302c]'
                              }`}
                              onClick={() => {
                                setSearchExpanded(false);
                                setShowResults(false);
                                setSearchQuery('');
                                setSelectedIndex(-1);
                              }}
                            >
                              {result.handle}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notifications */}
            <NotificationDropdown />

            {loading ? (
              <div className="w-8 h-8 border-2 border-orange-300 border-t-transparent rounded-full animate-spin"></div>
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 text-white light:text-black hover:text-orange-200 light:hover:text-orange-400 transition-colors px-3 py-2"
                >
                  <User className="h-5 w-5" />
                  <span className="font-medium">{user.handle}</span>
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 w-48 bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg shadow-lg z-20 py-1">
                      <Link
                        href={user.id.startsWith('guest_') ? '/guest/profile' : `/profile/${user.handle}`}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] transition-colors"
                      >
                        <User className="h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] transition-colors"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Messages</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                      <button
                        onClick={() => {
                          handleLogout();
                          setDropdownOpen(false);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 w-full text-left text-[#c1b9ad] hover:text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <GuestSettings />
                <Link
                  href="/auth/signin"
                  className="flex items-center space-x-1 text-[#c1b9ad] light:text-[#5a5449] hover:text-orange-400 light:hover:text-orange-500 px-4 py-2 rounded-lg hover:bg-[#2f2b27] light:hover:bg-[#f5f1ea] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-all duration-200"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Buttons */}
          <div className="lg:hidden flex items-center space-x-2 ml-auto">
            {/* Mobile Search Button */}
            <button
              onClick={() => setSearchExpanded(!searchExpanded)}
              className="p-2 rounded-lg text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#2f2b27] light:hover:bg-[#f0ebe0] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Mobile Notifications */}
            <NotificationDropdown />

            {/* Mobile Guest Settings - only show for guests */}
            {!session && <GuestSettings />}

            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#2f2b27] light:hover:bg-[#f0ebe0] border border-transparent hover:border-[#474239] light:hover:border-[#d4caba] transition-colors"
            >
              {isOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Dropdown */}
        {searchExpanded && (
          <div className="lg:hidden border-t border-[#3e3a33] light:border-[#d4caba] bg-[#2a2926]/95 light:bg-white/95 backdrop-blur-md py-4 px-4">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  setTimeout(() => {
                    setSearchExpanded(false);
                    setShowResults(false);
                    setSearchQuery('');
                    setSelectedIndex(-1);
                  }, 200);
                }}
                placeholder="Search user..."
                autoFocus
                className="w-full px-3 py-2 pl-9 bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg text-white light:text-black placeholder-[#6b6460] light:placeholder-[#9a958e] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent text-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6460] light:text-[#9a958e]" />
            </form>

            {showResults && (() => {
              const flatResults = [
                ...searchResults.discussions,
                ...searchResults.following,
                ...searchResults.players
              ];
              return flatResults.length > 0 ? (
                <div className="mt-2 bg-[#2a2926] light:bg-white border border-[#454038] light:border-[#d4caba] rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
                  {flatResults.map((result: { handle: string; userId?: string }, index: number) => (
                    <Link
                      key={`${result.handle}-${index}`}
                      href={`/profile/${result.handle}`}
                      className={`block px-4 py-2 text-white light:text-black transition-colors ${
                        index === selectedIndex ? 'bg-orange-300/20 border-l-2 border-orange-300' : 'hover:bg-[#33302c] light:hover:bg-[#f0ebe0]'
                      }`}
                      onClick={() => {
                        setSearchExpanded(false);
                        setShowResults(false);
                        setSearchQuery('');
                        setSelectedIndex(-1);
                      }}
                    >
                      {result.handle}
                    </Link>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        )}

      </div>
    </nav>

    {/* Mobile Navigation - Completely outside nav element */}
    {isOpen && (
      <>
        {/* Backdrop - Dims the landing page with smooth fade in */}
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setIsOpen(false)}
          style={{
            animation: 'fadeIn 0.2s ease-out'
          }}
        />

        {/* Slide-in Menu Panel from Right with smooth animation */}
        <div
          className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-gradient-to-b from-[#2a2926] to-[#252320] light:from-white light:to-[#faf7f2] shadow-2xl z-50 lg:hidden overflow-y-auto animate-[slideInRight_0.3s_ease-out]"
          style={{
            animation: 'slideInRight 0.3s ease-out',
            boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Header with Close */}
          <div
            className="flex items-center justify-between p-6 border-b border-[#3e3a33]/50 light:border-[#d4caba]/50"
            style={{
              animation: 'fadeIn 0.3s ease-out'
            }}
          >
            <h2 className="text-xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent">Menu</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:scale-110 transition-all duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Menu Content */}
          <div className="p-6">
            {user ? (
              <div className="space-y-6">
                {/* User Profile */}
                <Link
                  href={user.id.startsWith('guest_') ? '/guest/profile' : `/profile/${user.handle}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center space-x-3 p-4 bg-[#35322e] light:bg-[#faf7f2] border border-[#474239] light:border-[#d4caba] rounded-lg hover:border-orange-300/50 hover:shadow-[0_0_20px_rgba(251,146,60,0.2)] hover:-translate-y-0.5 transition-all duration-200 group"
                  style={{
                    animation: 'fadeIn 0.3s ease-out 0.1s both'
                  }}
                >
                  <div className="p-2 bg-gradient-to-br from-orange-300 to-orange-400 rounded-lg">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg text-white light:text-black group-hover:text-orange-400 transition-colors">
                      {user.handle}
                    </div>
                    <div className="text-xs text-[#a0958a] light:text-[#5a5449]">View profile</div>
                  </div>
                </Link>

                {/* Main Navigation Links */}
                <div className="space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`block px-4 py-3 transition-all duration-200 font-medium rounded-lg hover:translate-x-1 ${
                        isActive(item.href)
                          ? 'text-orange-400 bg-orange-400/10 border border-orange-400/20'
                          : 'text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}

                  {/* Tournaments Dropdown */}
                  <div className="space-y-1">
                    <button
                      onClick={() => setMobileTournamentsOpen(!mobileTournamentsOpen)}
                      className="flex items-center justify-between w-full px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                    >
                      <span>Tournaments</span>
                      <svg 
                        className={`h-4 w-4 transition-transform duration-200 ${mobileTournamentsOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {mobileTournamentsOpen && (
                      <div className="ml-4 space-y-1 border-l-2 border-[#474239] light:border-[#d4caba] pl-4">
                        <Link
                          href="/tournaments"
                          onClick={() => {
                            setIsOpen(false);
                            setMobileTournamentsOpen(false);
                          }}
                          className="block px-4 py-2 text-sm text-[#a0958a] light:text-[#6b6460] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                        >
                          Arena Tournaments
                        </Link>
                        <Link
                          href="/tournaments/team"
                          onClick={() => {
                            setIsOpen(false);
                            setMobileTournamentsOpen(false);
                          }}
                          className="block px-4 py-2 text-sm text-[#a0958a] light:text-[#6b6460] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                        >
                          Team Tournaments
                        </Link>
                        <Link
                          href="/tournaments/calendar"
                          onClick={() => {
                            setIsOpen(false);
                            setMobileTournamentsOpen(false);
                          }}
                          className="block px-4 py-2 text-sm text-[#a0958a] light:text-[#6b6460] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                        >
                          Tournament Calendar
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Main Navigation Links */}
                  <div className="space-y-2 pt-2">
                    <Link
                      href="/leaderboard"
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200 font-medium"
                    >
                      Leaderboard
                    </Link>

                    <Link
                      href="/donate"
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200 font-medium"
                    >
                      Donate
                    </Link>
                  </div>
                </div>

                {/* User Menu Links */}
                <div className="space-y-2 pt-4 border-t border-[#3e3a33]/50">
                  <Link
                    href="/messages"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                    style={{
                      animation: 'fadeIn 0.3s ease-out 0.2s both'
                    }}
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">Messages</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                    style={{
                      animation: 'fadeIn 0.3s ease-out 0.3s both'
                    }}
                  >
                    <Settings className="h-5 w-5" />
                    <span className="font-medium">Settings</span>
                  </Link>
                </div>

                {/* Logout */}
                <div
                  className="pt-4 border-t border-[#3e3a33]/50"
                  style={{
                    animation: 'fadeIn 0.3s ease-out 0.4s both'
                  }}
                >
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsOpen(false);
                    }}
                    className="flex items-center space-x-3 px-4 py-3 w-full text-left text-[#c1b9ad] hover:text-red-400 hover:bg-red-500/10 hover:translate-x-1 rounded-lg transition-all duration-200"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Main Navigation Links */}
                <div className="space-y-2">
                  <Link
                    href="/"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200 font-medium"
                  >
                    Home
                  </Link>

                  <Link
                    href="/play"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200 font-medium"
                  >
                    Play
                  </Link>

                  {/* Tournaments Dropdown */}
                  <div className="space-y-1">
                    <button
                      onClick={() => setMobileTournamentsOpen(!mobileTournamentsOpen)}
                      className="flex items-center justify-between w-full px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                    >
                      <span>Tournaments</span>
                      <svg 
                        className={`h-4 w-4 transition-transform duration-200 ${mobileTournamentsOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {mobileTournamentsOpen && (
                      <div className="ml-4 space-y-1 border-l-2 border-[#474239] light:border-[#d4caba] pl-4">
                        <Link
                          href="/tournaments"
                          onClick={() => {
                            setIsOpen(false);
                            setMobileTournamentsOpen(false);
                          }}
                          className="block px-4 py-2 text-sm text-[#a0958a] light:text-[#6b6460] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                        >
                          Arena Tournaments
                        </Link>
                        <Link
                          href="/tournaments/team"
                          onClick={() => {
                            setIsOpen(false);
                            setMobileTournamentsOpen(false);
                          }}
                          className="block px-4 py-2 text-sm text-[#a0958a] light:text-[#6b6460] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                        >
                          Team Tournaments
                        </Link>
                        <Link
                          href="/tournaments/calendar"
                          onClick={() => {
                            setIsOpen(false);
                            setMobileTournamentsOpen(false);
                          }}
                          className="block px-4 py-2 text-sm text-[#a0958a] light:text-[#6b6460] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200"
                        >
                          Tournament Calendar
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Main Navigation Links */}
                  <div className="space-y-2 pt-2">
                    <Link
                      href="/leaderboard"
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200 font-medium"
                    >
                      Leaderboard
                    </Link>

                    <Link
                      href="/donate"
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-3 text-[#c1b9ad] light:text-[#4a453e] hover:text-white light:hover:text-black hover:bg-[#33302c] light:hover:bg-[#f0ebe0] hover:translate-x-1 rounded-lg transition-all duration-200 font-medium"
                    >
                      Donate
                    </Link>

                  </div>
                </div>

                {/* Sign In Button */}
                <div className="pt-4 border-t border-[#3e3a33]/50">
                  <Link
                    href="/auth/signin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-400 hover:to-orange-500 hover:shadow-[0_0_20px_rgba(251,146,60,0.4)] hover:scale-105 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
                  >
                    <LogIn className="h-5 w-5" />
                    <span>Sign In</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

    {/* Time Control Modal */}
    <TimeControlModal
      isOpen={timeControlModalOpen}
      onClose={() => setTimeControlModalOpen(false)}
      defaultSpeed={selectedSpeed}
      userRating={(session?.user as any)?.rating || 1500}
    />
    </>
  );
}