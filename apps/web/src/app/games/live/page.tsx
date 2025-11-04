'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, Users, Eye } from 'lucide-react';

interface LiveGame {
  id: string;
  whiteId: string;
  blackId: string;
  whiteHandle: string;
  blackHandle: string;
  tc: string;
  variant: string;
  chess960Position?: number;
  rated: boolean;
  startedAt: string | null;
  moveCount: number;
  spectatorCount: number;
}

export default function LiveGamesPage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveGames = async () => {
    try {
      const response = await fetch('/api/games/live');
      if (!response.ok) {
        throw new Error('Failed to fetch live games');
      }
      const data = await response.json();
      setGames(data.games || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching live games:', err);
      setError('Failed to load live games');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveGames();
    // Refresh every 5 seconds
    const interval = setInterval(fetchLiveGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (startedAt: string | null) => {
    if (!startedAt) return 'Just started';
    const started = new Date(startedAt);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - started.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Live Games</h1>
          <p className="text-[#a0958a] light:text-[#5a5449]">
            Watch games as they happen in real-time
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {games.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-[#a0958a] light:text-[#5a5449] text-lg">
              No live games at the moment
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <Link
              key={game.id}
              href={`/game/${game.id}/live`}
              className="block bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 hover:border-orange-400/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm text-[#a0958a] light:text-[#5a5449]">
                  <Clock className="h-4 w-4" />
                  <span>{game.tc}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#a0958a] light:text-[#5a5449]">
                  <Users className="h-4 w-4" />
                  <span>{game.spectatorCount}</span>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-white light:text-black font-semibold">
                    {game.whiteHandle}
                  </span>
                  <span className="text-sm text-[#a0958a] light:text-[#5a5449]">vs</span>
                  <span className="text-white light:text-black font-semibold">
                    {game.blackHandle}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-[#a0958a] light:text-[#5a5449]">
                <span>{game.moveCount} moves</span>
                <span>{formatTimeAgo(game.startedAt)}</span>
              </div>

              <div className="mt-3 pt-3 border-t border-[#3e3a33] light:border-[#d4caba]">
                <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold">
                  <Eye className="h-4 w-4" />
                  <span>Watch Live</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
