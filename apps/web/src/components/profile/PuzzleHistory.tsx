'use client';

import { useState, useEffect } from 'react';
import { Puzzle, TrendingUp, TrendingDown, Trophy, Filter, X } from 'lucide-react';
import Link from 'next/link';

interface PuzzleRound {
  id: string;
  puzzleId: string;
  puzzleRating: number;
  win: boolean;
  ratingBefore: number;
  ratingAfter: number;
  ratingDiff: number;
  createdAt: string;
  themes: string[];
}

interface PuzzleStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  currentRating: number;
}

interface PuzzleHistoryProps {
  userId: string;
  username: string;
}

type ResultFilter = 'all' | 'wins' | 'losses';

export function PuzzleHistory({ userId, username: _username }: PuzzleHistoryProps) {
  const [rounds, setRounds] = useState<PuzzleRound[]>([]);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | 'rated' | 'casual'>('all');

  const fetchHistory = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await fetch(
        `/api/puzzle/history?userId=${userId}&limit=50&offset=${reset ? 0 : offset}`
      );
      if (!response.ok) throw new Error('Failed to fetch puzzle history');

      const data = await response.json();
      
      if (reset) {
        setRounds(data.rounds);
        setStats(data.stats);
      } else {
        setRounds((prev) => [...prev, ...data.rounds]);
      }
      
      setHasMore(data.pagination.hasMore);
      setOffset(reset ? data.rounds.length : offset + data.rounds.length);
    } catch (error) {
      console.error('Error fetching puzzle history:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHistory(true);
  }, [userId]);

  const filteredRounds = rounds.filter((round) => {
    if (resultFilter === 'wins' && !round.win) return false;
    if (resultFilter === 'losses' && round.win) return false;
    if (ratingFilter === 'rated' && round.ratingDiff === 0) return false;
    if (ratingFilter === 'casual' && round.ratingDiff !== 0) return false;
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading && rounds.length === 0) {
    return (
      <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-[#a0958a] light:text-[#5a5449]">Loading puzzle history...</div>
        </div>
      </div>
    );
  }

  if (!stats || rounds.length === 0) {
    return (
      <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Puzzle className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold text-white light:text-black">Puzzle History</h2>
        </div>
        <div className="text-center py-8 text-[#a0958a] light:text-[#5a5449]">
          <Puzzle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No puzzles solved yet</p>
          <Link
            href="/puzzle/daily"
            className="mt-4 inline-block text-orange-400 hover:text-orange-500 transition-colors"
          >
            Start solving puzzles →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#35322e]/50 light:bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-[#474239] light:border-[#d4caba] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Puzzle className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold text-white light:text-black">Puzzle History</h2>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="p-2 hover:bg-[#474239] light:hover:bg-[#d4caba] rounded transition-colors"
        >
          <Filter className="w-4 h-4 text-[#a0958a] light:text-[#5a5449]" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-3">
          <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1">Rating</div>
          <div className="text-lg sm:text-xl font-bold text-white light:text-black">{stats.currentRating}</div>
        </div>
        <div className="bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-3">
          <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1">Solved</div>
          <div className="text-lg sm:text-xl font-bold text-green-400">{stats.wins}</div>
        </div>
        <div className="bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-3">
          <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1">Failed</div>
          <div className="text-lg sm:text-xl font-bold text-red-400">{stats.losses}</div>
        </div>
        <div className="bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-3">
          <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449] mb-1">Win Rate</div>
          <div className="text-lg sm:text-xl font-bold text-orange-400">{stats.winRate}%</div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white light:text-black">Filters</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="p-1 hover:bg-[#474239] light:hover:bg-[#d4caba] rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-[#a0958a] light:text-[#5a5449] mb-1">Result</label>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
                className="text-sm bg-[#3e3a33] light:bg-[#d4caba] border border-[#3e3a33] light:border-[#d4caba] text-white light:text-black rounded px-2 py-1 focus:ring-orange-400 focus:ring-2 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="wins">Wins</option>
                <option value="losses">Losses</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#a0958a] light:text-[#5a5449] mb-1">Mode</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value as 'all' | 'rated' | 'casual')}
                className="text-sm bg-[#3e3a33] light:bg-[#d4caba] border border-[#3e3a33] light:border-[#d4caba] text-white light:text-black rounded px-2 py-1 focus:ring-orange-400 focus:ring-2 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="rated">Rated</option>
                <option value="casual">Casual</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Rounds List */}
      <div className="space-y-2">
        {filteredRounds.length === 0 ? (
          <div className="text-center py-8 text-[#a0958a] light:text-[#5a5449]">
            <p>No puzzles match the selected filters</p>
          </div>
        ) : (
          filteredRounds.map((round) => (
            <Link
              key={round.id}
              href={`/puzzle/${round.puzzleId}`}
              className="block bg-[#2a2926] light:bg-white/80 rounded-lg border border-[#3e3a33] light:border-[#d4caba] p-3 sm:p-4 hover:bg-[#3e3a33] light:hover:bg-white transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded flex items-center justify-center flex-shrink-0 ${
                      round.win
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-red-500/20 border border-red-500/30'
                    }`}
                  >
                    {round.win ? (
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-semibold text-white light:text-black">
                        {round.win ? 'Solved' : 'Failed'}
                      </span>
                      <span className="text-xs sm:text-sm text-[#a0958a] light:text-[#5a5449]">
                        Rating: {round.puzzleRating}
                      </span>
                      {round.ratingDiff !== 0 && (
                        <span
                          className={`text-xs sm:text-sm font-semibold flex items-center gap-1 ${
                            round.ratingDiff > 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {round.ratingDiff > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {round.ratingDiff > 0 ? '+' : ''}
                          {round.ratingDiff}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#a0958a] light:text-[#5a5449] mt-1">
                      {formatDate(round.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchHistory(false)}
            disabled={loadingMore}
            className="px-4 py-2 bg-[#3e3a33] light:bg-[#d4caba] hover:bg-[#474239] light:hover:bg-[#c4b5a5] text-white light:text-black rounded transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

