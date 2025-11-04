'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TimeControlModal } from '@/components/game/TimeControlModal';
import { LiveStats } from '@/components/LiveStats';
import { BetaNotification } from '@/components/BetaNotification';
import { useHomepageWebSocket } from '@/hooks/useHomepageWebSocket';
import { FeaturedLiveGames } from '@/components/homepage/FeaturedLiveGames';

export default function HomePageClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [timeControlModalOpen, setTimeControlModalOpen] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState<'bullet' | 'blitz' | 'rapid' | 'classical'>('bullet');
  const [isVisible, setIsVisible] = useState(false);

  // Establish WebSocket connection for online user tracking
  useHomepageWebSocket();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Trigger fade-in animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  // Handle authentication redirects
  useEffect(() => {
    // Only redirect if we're fully authenticated and have user data
    if (status === 'authenticated' && session?.user) {
      // Check if user has a handle, if not redirect to setup
      if (!(session.user as any).handle) {
        router.push('/auth/setup-username');
      }
    }
  }, [status, session, router]);

  // Show loading state while authentication is being processed
  if (status === 'loading') {
    return (
      <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-[#b6aea2] light:text-[#5a5449]">Loading...</p>
        </div>
      </div>
    );
  }

  const handlePlayClick = () => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else {
      setTimeControlModalOpen(true);
    }
  };

  const handleTimeControlSelect = (speed: 'bullet' | 'blitz' | 'rapid' | 'classical') => {
    setSelectedSpeed(speed);
    setTimeControlModalOpen(false);
    router.push(`/play?speed=${speed}`);
  };

  return (
    <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
      {/* Background layers - Fixed for smooth scrolling */}
      <div className="pointer-events-none fixed inset-0">
        {/* Radial spotlight - Dark mode */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-0 md:-mt-40 h-[520px] w-[520px] rounded-full blur-3xl will-change-transform opacity-20 dark:block light:hidden"
             style={{ background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.35), rgba(234,88,12,0.15) 45%, transparent 60%)' }} />
        {/* Radial spotlight - Light mode */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-0 md:-mt-40 h-[520px] w-[520px] rounded-full blur-3xl will-change-transform opacity-30 hidden light:block"
             style={{ background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.6), rgba(234,88,12,0.3) 45%, transparent 60%)' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          {/* Dark mode grid - white lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
          {/* Light mode grid - black lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
        </div>

        {/* Chess Masters - Decorative Images */}
        {/* Bobby Fischer - Center top */}
        <div className="absolute left-1/2 -translate-x-1/2 top-16 md:top-20 w-48 md:w-72 h-auto opacity-10 will-change-transform">
          <Image
            src="/bobby-fischer.png"
            alt="Bobby Fischer"
            width={600}
            height={750}
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center py-20 md:py-8">
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Beta Notification with Email Signup */}
          <div className={`mb-6 sm:mb-8 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <BetaNotification />
          </div>

          {/* Title removed */}
        <p className={`mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-[#b6aea2] light:text-[#5a5449] max-w-2xl mx-auto transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          Fischer Random Chess with randomized starting positions.
        </p>
        <p className={`mt-2 text-sm sm:text-base md:text-lg text-[#b6aea2] light:text-[#5a5449] max-w-2xl mx-auto transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          No opening theory, just pure chess.
        </p>

        {/* Live Stats */}
        <div className={`mt-4 sm:mt-6 flex justify-center transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <LiveStats />
        </div>

        {/* Time Controls - Category First */}
        <div className="mt-8 sm:mt-10 md:mt-12 max-w-4xl mx-auto">
          {/* Speed Categories */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-12">
            {/* Bullet */}
            <button
              onClick={() => {
                setSelectedSpeed('bullet');
                setTimeControlModalOpen(true);
              }}
              className={`w-full bg-gradient-to-br from-[#35322e] to-[#2a2926] light:from-white light:to-[#faf7f2] border border-[#474239] light:border-[#d4caba] hover:border-orange-300 rounded-xl p-4 sm:p-6 transition-all duration-200 hover:shadow-[0_0_20px_rgba(251,146,60,0.3)] sm:hover:scale-105 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isVisible ? '0ms' : '500ms' }}
            >
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-white light:text-black">Bullet</div>
              </div>
            </button>

            {/* Blitz */}
            <button
              onClick={() => {
                setSelectedSpeed('blitz');
                setTimeControlModalOpen(true);
              }}
              className={`w-full bg-gradient-to-br from-[#35322e] to-[#2a2926] light:from-white light:to-[#faf7f2] border border-[#474239] light:border-[#d4caba] hover:border-orange-300 rounded-xl p-4 sm:p-6 transition-all duration-200 hover:shadow-[0_0_20px_rgba(251,146,60,0.3)] sm:hover:scale-105 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isVisible ? '0ms' : '600ms' }}
            >
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-white light:text-black">Blitz</div>
              </div>
            </button>

            {/* Rapid */}
            <button
              onClick={() => {
                setSelectedSpeed('rapid');
                setTimeControlModalOpen(true);
              }}
              className={`w-full bg-gradient-to-br from-[#35322e] to-[#2a2926] light:from-white light:to-[#faf7f2] border border-[#474239] light:border-[#d4caba] hover:border-orange-300 rounded-xl p-4 sm:p-6 transition-all duration-200 hover:shadow-[0_0_20px_rgba(251,146,60,0.3)] sm:hover:scale-105 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isVisible ? '0ms' : '700ms' }}
            >
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-white light:text-black">Rapid</div>
              </div>
            </button>

            {/* Classical */}
            <button
              onClick={() => {
                setSelectedSpeed('classical');
                setTimeControlModalOpen(true);
              }}
              className={`w-full bg-gradient-to-br from-[#35322e] to-[#2a2926] light:from-white light:to-[#faf7f2] border border-[#474239] light:border-[#d4caba] hover:border-orange-300 rounded-xl p-4 sm:p-6 transition-all duration-200 hover:shadow-[0_0_20px_rgba(251,146,60,0.3)] sm:hover:scale-105 cursor-pointer ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isVisible ? '0ms' : '800ms' }}
            >
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold text-white light:text-black">Classical</div>
              </div>
            </button>
          </div>
        </div>

        </div>
      </div>

      {/* Featured Live Games */}
      <div className="relative">
        <FeaturedLiveGames />
      </div>

      {/* Time Control Modal */}
      <TimeControlModal
        isOpen={timeControlModalOpen}
        onClose={() => setTimeControlModalOpen(false)}
        defaultSpeed={selectedSpeed}
        userRating={(session?.user as any)?.rating || 1500}
      />
    </div>
  );
}