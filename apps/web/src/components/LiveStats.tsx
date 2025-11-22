'use client';

import { useState, useEffect } from 'react';
import { Users, Gamepad2 } from 'lucide-react';

interface Stats {
  playersOnline: number;
  gamesInProgress: number;
}

export function LiveStats() {
  const [stats, setStats] = useState<Stats>({ playersOnline: 0, gamesInProgress: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          setStats({
            playersOnline: data.playersOnline || 0,
            gamesInProgress: data.gamesInProgress || 0,
          });
        } else {
          setStats({ playersOnline: 0, gamesInProgress: 0 });
        }
      } catch (error) {
        // Stats service unavailable, show default values
        setStats({ playersOnline: 0, gamesInProgress: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately
    fetchStats();

    // Then fetch every 5 seconds for more real-time updates
    const interval = setInterval(fetchStats, 5000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return null; // Don't show anything while loading
  }

  return (
    <div className="inline-flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="relative">
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>
        <span className="font-medium">
          <span className="text-white light:text-black">{stats.playersOnline}</span> <span className="text-[#a0958a] light:text-[#5a5449]">online</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Gamepad2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
        <span className="font-medium">
          <span className="text-white light:text-black">{stats.gamesInProgress}</span> <span className="text-[#a0958a] light:text-[#5a5449]">playing</span>
        </span>
      </div>
    </div>
  );
}
