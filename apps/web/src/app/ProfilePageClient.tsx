'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserPlus, Check, MessageSquare, BarChart3, Ban, UserX } from 'lucide-react';
import Link from 'next/link';
import { UserActivity } from '@/components/profile/UserActivity';
import { GameHistory } from '@/components/profile/GameHistory';
import { ChallengeButton } from '@/components/profile/ChallengeButton';
import { RatingGraph } from '@/components/profile/RatingGraph';
import { useProfileWebSocket } from '@/hooks/useProfileWebSocket';

interface UserStats {
  id: string;
  handle: string;
  fullName?: string | null;
  country?: string | null;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  ratings: {
    tc: string;
    rating: number;
    rd: number;
  }[];
  createdAt: string;
  lastActivityAt?: string | null;
}

const countries = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' }, { code: 'AO', name: 'Angola' }, { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' }, { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' }, { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' }, { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' }, { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' }, { code: 'BT', name: 'Bhutan' }, { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' }, { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' }, { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' }, { code: 'CV', name: 'Cabo Verde' }, { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' }, { code: 'CA', name: 'Canada' }, { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' }, { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' }, { code: 'CG', name: 'Congo' },
  { code: 'CR', name: 'Costa Rica' }, { code: 'HR', name: 'Croatia' }, { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czech Republic' }, { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' }, { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' }, { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' }, { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Ethiopia' }, { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' }, { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' }, { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Greece' }, { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' }, { code: 'GN', name: 'Guinea' }, { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' }, { code: 'HT', name: 'Haiti' }, { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' }, { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' }, { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' }, { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' }, { code: 'JP', name: 'Japan' }, { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' }, { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'North Korea' }, { code: 'KR', name: 'South Korea' }, { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' }, { code: 'LA', name: 'Laos' }, { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' }, { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' }, { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' }, { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' }, { code: 'MH', name: 'Marshall Islands' }, { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' }, { code: 'MX', name: 'Mexico' }, { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' }, { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' }, { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' }, { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' }, { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' }, { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' },
  { code: 'MK', name: 'North Macedonia' }, { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' }, { code: 'PW', name: 'Palau' }, { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' }, { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' }, { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' }, { code: 'QA', name: 'Qatar' }, { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' }, { code: 'RW', name: 'Rwanda' }, { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' }, { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' }, { code: 'SM', name: 'San Marino' }, { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' }, { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' }, { code: 'SL', name: 'Sierra Leone' }, { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' }, { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' }, { code: 'ZA', name: 'South Africa' }, { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' }, { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' }, { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' }, { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' }, { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' }, { code: 'TO', name: 'Tonga' }, { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' }, { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' }, { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' }, { code: 'UY', name: 'Uruguay' }, { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' }, { code: 'VA', name: 'Vatican City' }, { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' }, { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' }
];

export default function ProfilePageClient() {
  const params = useParams();
  const username = params.username as string;
  const { data: session } = useSession();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('bullet');
  const [showContent, setShowContent] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    setShowContent(false); // Reset fade-in for new profile
    setStats(null); // Clear previous stats
    setLoading(true); // Reset loading state
    setError(''); // Clear any errors
    fetchUserStats();
  }, [username]);

  useEffect(() => {
    if (stats?.id && session?.user) {
      checkFollowStatus();
      checkBlockStatus();
    }
  }, [stats?.id, session?.user]);

  // Clear stats when session changes (e.g., after logout)
  useEffect(() => {
    if (!session?.user) {
      // If user logged out, clear stats to prevent showing stale data
      setStats(null);
      setLoading(true);
      setError('');
    }
  }, [session]);

  // Real-time updates for profile data
  const handleProfileUpdate = (update: any) => {
    console.log('[PROFILE] Received update:', update);
    
    if (update.type === 'game_ended' || update.type === 'rating_updated' || update.type === 'stats_updated') {
      // Refresh the profile data
      fetchUserStats();
      // Force refresh of child components
      setRefreshKey(prev => prev + 1);
    }
  };

  // Set up WebSocket connection for real-time updates
  useProfileWebSocket(stats?.id || '', handleProfileUpdate);

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`/api/user/stats/${username}`);
      if (!response.ok) {
        setError('User not found');
        return;
      }
      const data = await response.json();
      setStats(data);
      // Delay showing content slightly to ensure all data is ready
      setTimeout(() => setShowContent(true), 100);
    } catch {
      setError('Failed to load user statistics');
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!session?.user || !stats?.id) return;

    try {
      const response = await fetch('/api/follow/list');
      if (response.ok) {
        const data = await response.json();
        const following = data.following.some((f: any) => f.id === stats.id);
        setIsFollowing(following);
      }
    } catch (error) {
      console.error('Failed to check follow status:', error);
    }
  };

  const checkBlockStatus = async () => {
    if (!session?.user || !stats?.id) return;

    try {
      const response = await fetch(`/api/block?userId=${stats.id}`);
      if (response.ok) {
        const data = await response.json();
        setIsBlocked(data.isBlocked);
      }
    } catch (error) {
      console.error('Failed to check block status:', error);
    }
  };

  const handleBlockToggle = async () => {
    if (!stats?.id || blockLoading) return;

    setBlockLoading(true);
    try {
      if (isBlocked) {
        // Unblock
        const response = await fetch('/api/block', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: stats.id }),
        });

        if (response.ok) {
          setIsBlocked(false);
        } else {
          const error = await response.json();
          console.error('Unblock failed:', error);
          alert(error.error || 'Failed to unblock');
        }
      } else {
        // Block
        const confirmed = window.confirm(
          `Are you sure you want to block ${stats.handle}? You won't be able to message, challenge, or be matched with them.`
        );
        if (!confirmed) {
          setBlockLoading(false);
          return;
        }

        const response = await fetch('/api/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: stats.id }),
        });

        if (response.ok) {
          setIsBlocked(true);
          setIsFollowing(false); // Unfollow when blocking
        } else {
          const error = await response.json();
          console.error('Block failed:', error);
          alert(error.error || 'Failed to block');
        }
      }
    } catch (error) {
      console.error('Block toggle error:', error);
      alert('An error occurred');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!stats?.id || followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/follow?userId=${stats.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setIsFollowing(false);
        } else {
          const error = await response.json();
          console.error('Unfollow failed:', error);
          alert(error.error || 'Failed to unfollow');
        }
      } else {
        // Follow
        const response = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: stats.id }),
        });

        console.log('Follow response status:', response.status);
        const responseText = await response.text();
        console.log('Follow response text:', responseText);

        if (response.ok) {
          setIsFollowing(true);
        } else {
          try {
            const error = JSON.parse(responseText);
            console.error('Follow failed:', error);
            alert(error.error || 'Failed to follow');
          } catch {
            console.error('Follow failed with non-JSON response:', responseText);
            alert('Failed to follow. Please try again.');
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-300 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-400 mb-4">User Not Found</h1>
          <p className="text-[#a0958a]">{error || 'This user does not exist'}</p>
        </div>
      </div>
    );
  }


  const winRate = stats.gamesPlayed > 0
    ? ((stats.gamesWon / stats.gamesPlayed) * 100).toFixed(1)
    : '0.0';

  const memberSince = new Date(stats.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const getLastActivityText = () => {
    if (!stats.lastActivityAt) return 'Never';

    const now = new Date();
    const lastActivity = new Date(stats.lastActivityAt);
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months === 1 ? '' : 's'} ago`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black py-3 sm:py-8 md:py-12">
      <div className={`max-w-6xl mx-auto px-3 sm:px-4 transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {/* User Header */}
        <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-[#474239] light:border-[#d4caba] p-3 sm:p-6 md:p-8 mb-3 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl md:text-4xl text-white light:text-black font-geist">
                {stats.handle}
              </h1>
              {(stats.fullName || stats.country) && (
                <div className="text-[#c1b9ad] light:text-[#5a5449] mt-1.5 sm:mt-2 text-sm sm:text-base md:text-lg">
                  {stats.fullName && <span>{stats.fullName}</span>}
                  {stats.fullName && stats.country && <span> · </span>}
                  {stats.country && <span>{countries.find(c => c.code === stats.country)?.name || stats.country}</span>}
                </div>
              )}
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base space-y-0.5 sm:space-y-1">
                <p className="text-[#a0958a] light:text-[#5a5449]">Member since {memberSince}</p>
                <p className="text-[#a0958a] light:text-[#5a5449]">Last active: <span className="text-white light:text-black">{getLastActivityText()}</span></p>
              </div>
            </div>

            {/* Action Buttons - Only show if viewing someone else's profile and logged in */}
            {session?.user && stats.handle !== (session.user as any).handle && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                {/* Challenge Button - always show, privacy checked on backend */}
                <ChallengeButton userId={stats.id} userHandle={stats.handle} />

                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl ${
                    isFollowing
                      ? 'bg-gray-600 hover:bg-gray-700'
                      : 'bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  {isFollowing ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />}
                  {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                </button>

                {isFollowing && !isBlocked && (
                  <a
                    href="/messages"
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-gradient-to-r from-orange-300 to-orange-400 hover:from-orange-600 hover:to-red-700 text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                    Message
                  </a>
                )}

                <button
                  onClick={handleBlockToggle}
                  disabled={blockLoading}
                  className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl ${
                    isBlocked
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                  title={isBlocked ? 'Unblock this user' : 'Block this user'}
                >
                  {isBlocked ? (
                    <>
                      <UserX className="h-4 w-4 sm:h-5 sm:w-5" />
                      Unblock
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
                      Block
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ratings */}
        <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-[#474239] light:border-[#d4caba] mb-3 sm:mb-6 md:mb-8">
          {/* Rating Display */}
          <div className="p-3 sm:p-5 md:p-6">
            {/* Speed Category Selector */}
            <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 flex-wrap">
              {[
                { key: 'bullet', label: 'Bullet', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' },
                { key: 'blitz', label: 'Blitz', color: 'text-orange-400', bgColor: 'bg-orange-400/20', borderColor: 'border-orange-400/30' },
                { key: 'rapid', label: 'Rapid', color: 'text-green-500', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/30' },
                { key: 'classical', label: 'Classical', color: 'text-blue-500', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' }
              ].map(({ key, label, color, bgColor, borderColor }) => (
                <button
                  key={key}
                  onClick={() => setSelectedSpeed(key as any)}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border ${
                    selectedSpeed === key
                      ? 'bg-orange-400 text-white shadow-lg border-orange-400 transform scale-105'
                      : `bg-[#474239] light:bg-[#d4caba] text-[#a0958a] light:text-[#5a5449] hover:bg-[#5a5449] light:hover:bg-[#a0958a] hover:shadow-md border-[#474239] light:border-[#d4caba] hover:${bgColor} hover:${borderColor}`
                  }`}
                >
                  <span className={`${selectedSpeed === key ? 'text-white' : color} font-semibold flex items-center gap-1 sm:gap-2`}>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${selectedSpeed === key ? 'bg-white' : 'bg-current'}`}></div>
                    {label}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Speed Category Info */}
            <div className="mb-4 p-3 bg-[#2a2723] light:bg-[#f5f1ea] rounded-lg border border-[#474239] light:border-[#d4caba]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white light:text-black font-semibold capitalize">{selectedSpeed} Games</h4>
                  <p className="text-xs text-[#a0958a] light:text-[#5a5449]">
                    {selectedSpeed === 'bullet' && '1+0, 2+0, 2+1 (under 3 minutes)'}
                    {selectedSpeed === 'blitz' && '3+0, 3+2, 5+0, 5+3 (3-8 minutes)'}
                    {selectedSpeed === 'rapid' && '10+0, 10+5, 15+0, 15+10 (8-25 minutes)'}
                    {selectedSpeed === 'classical' && '30+0, 30+20, 60+0 (25+ minutes)'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#a0958a] light:text-[#5a5449]">Time Controls</div>
                  <div className="text-xs text-white light:text-black font-mono">
                    {selectedSpeed === 'bullet' && '1+0, 2+0, 2+1'}
                    {selectedSpeed === 'blitz' && '3+0, 3+2, 5+0, 5+3'}
                    {selectedSpeed === 'rapid' && '10+0, 10+5, 15+0, 15+10'}
                    {selectedSpeed === 'classical' && '30+0, 30+20, 60+0'}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Rating Display */}
            <div className="mb-4 sm:mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-4">
                <div className="bg-[#2a2723] light:bg-[#f5f1ea] rounded-lg p-3 sm:p-4 border border-[#474239] light:border-[#d4caba]">
                  <div className="text-xs text-[#a0958a] light:text-[#5a5449] mb-1">Current Rating</div>
                  <div className="text-xl sm:text-2xl font-bold text-white light:text-black">
                    {stats.ratings.find(r => {
                      const speedMap = {
                        bullet: ['1+0', '2+0', '2+1'],
                        blitz: ['3+0', '3+2', '5+0', '5+3'],
                        rapid: ['10+0', '10+5', '15+0', '15+10'],
                        classical: ['30+0', '30+20', '60+0']
                      };
                      return speedMap[selectedSpeed]?.includes(r.tc);
                    })?.rating || 'N/A'}
                  </div>
                </div>
                <div className="bg-[#2a2723] light:bg-[#f5f1ea] rounded-lg p-3 sm:p-4 border border-[#474239] light:border-[#d4caba]">
                  <div className="text-xs text-[#a0958a] light:text-[#5a5449] mb-1">Rating Deviation</div>
                  <div className="text-xl sm:text-2xl font-bold text-orange-400">
                    {stats.ratings.find(r => {
                      const speedMap = {
                        bullet: ['1+0', '2+0', '2+1'],
                        blitz: ['3+0', '3+2', '5+0', '5+3'],
                        rapid: ['10+0', '10+5', '15+0', '15+10'],
                        classical: ['30+0', '30+20', '60+0']
                      };
                      return speedMap[selectedSpeed]?.includes(r.tc);
                    })?.rd || 'N/A'}
                  </div>
                </div>
                <div className="bg-[#2a2723] light:bg-[#f5f1ea] rounded-lg p-3 sm:p-4 border border-[#474239] light:border-[#d4caba]">
                  <div className="text-xs text-[#a0958a] light:text-[#5a5449] mb-1">Games Played</div>
                  <div className="text-xl sm:text-2xl font-bold text-white light:text-black">
                    {stats.gamesPlayed}
                  </div>
                </div>
              </div>
            </div>

            {/* Rating Graph */}
            <RatingGraph key={`rating-${refreshKey}`} username={stats.handle} speed={selectedSpeed} />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-6 md:mb-8">
          <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-3 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1 sm:mb-2">Games Played</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white light:text-black">{stats.gamesPlayed}</div>
          </div>

          <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-3 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1 sm:mb-2">Wins</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-400">{stats.gamesWon}</div>
          </div>

          <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-3 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1 sm:mb-2">Losses</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-red-400">{stats.gamesLost}</div>
          </div>

          <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-3 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1 sm:mb-2">Draws</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-400">{stats.gamesDrawn}</div>
          </div>

          <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-3 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1 sm:mb-2">Win Rate</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-400">{winRate}%</div>
          </div>
        </div>

        {/* Puzzle Dashboard Link */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/puzzle/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-400 hover:bg-orange-500 text-black rounded-lg font-medium transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            View Puzzle Dashboard
          </Link>
        </div>

        {/* Game History */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <GameHistory key={`history-${refreshKey}`} userId={stats.id} username={stats.handle} />
        </div>

        {/* Recent Activity */}
        <UserActivity key={`activity-${refreshKey}`} handle={username} userId={stats.id} />
      </div>
    </div>
  );
}
