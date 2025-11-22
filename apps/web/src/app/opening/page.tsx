'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Database, TrendingUp, BarChart3, Gamepad2 } from 'lucide-react';

interface Opening {
  id: string;
  name: string;
  eco: string | null;
  moves: string;
  fen: string;
  chess960Position: number | null;
  moveCount: number;
  gameCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function OpeningExplorerPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchOpenings = async () => {
    try {
      setLoading(true);
      const url = `/api/opening?q=${encodeURIComponent(searchQuery)}&limit=50`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('API error:', response.status, response.statusText);
        setOpenings([]);
        return;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error('API returned error:', data.error);
        setOpenings([]);
        return;
      }
      
      setOpenings(data.openings || []);
    } catch (error) {
      console.error('Error searching openings:', error);
      setOpenings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOpenings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/opening?limit=20');
      
      if (!response.ok) {
        console.error('API error:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        setOpenings([]);
        return;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error('API returned error:', data.error);
        setOpenings([]);
        return;
      }
      
      setOpenings(data.openings || []);
    } catch (error) {
      console.error('Error fetching openings:', error);
      setOpenings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If query is a number (1-960), search immediately even with 1 digit
    const isNumber = /^\d+$/.test(searchQuery);
    if (isNumber && parseInt(searchQuery) >= 1 && parseInt(searchQuery) <= 960) {
      searchOpenings();
    } else if (searchQuery.length >= 2) {
      searchOpenings();
    } else if (searchQuery.length === 0) {
      // Load popular openings or recent
      fetchRecentOpenings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Database className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-orange-400" />
            Opening Explorer
          </h1>
          <div className="text-[#b6aea2] light:text-[#5a5449] max-w-2xl mx-auto space-y-2 px-4">
            <p className="text-sm sm:text-base">
              Explore chess openings with statistics and game database
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 sm:mb-8 max-w-2xl mx-auto px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[#a0958a] light:text-[#6b6560]" />
            <input
              type="text"
              placeholder="Search by position number (1-960) or opening name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-lg text-white light:text-black focus:outline-none focus:border-orange-300 transition-colors text-sm sm:text-base"
            />
          </div>
          <p className="mt-2 text-xs sm:text-sm text-[#6b6460] light:text-[#a0958a] text-center">
            Search by Chess960 position number (1-960) or opening name
          </p>
        </div>

        {/* Openings List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-[#a0958a] light:text-[#6b6560]">Searching openings...</p>
          </div>
        ) : openings.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-[#a0958a] light:text-[#6b6560] mx-auto mb-4" />
            <p className="text-[#a0958a] light:text-[#6b6560] text-lg">
              {searchQuery ? 'No openings found matching your search' : 'Start typing to search openings'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-0">
            {openings.map((opening) => (
              <Link
                key={opening.id}
                href={`/opening/${opening.id}`}
                className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4 sm:p-6 hover:border-orange-300/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <h3 className="text-lg sm:text-xl font-semibold text-white light:text-black flex-1 pr-2">
                    {opening.name}
                  </h3>
                  {opening.chess960Position && (
                    <span className="px-2 py-1 text-xs bg-orange-500/20 light:bg-orange-100 border border-orange-500/30 light:border-orange-300 rounded text-orange-300 light:text-orange-600 font-semibold flex-shrink-0">
                      #{opening.chess960Position}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560] mb-3 sm:mb-4 font-mono">
                  {opening.moves.split(' ').slice(0, 6).join(' ')}
                  {opening.moves.split(' ').length > 6 && '...'}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560]">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
                    {opening.moveCount} {opening.moveCount === 1 ? 'move' : 'moves'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    {opening.gameCount} {opening.gameCount === 1 ? 'game' : 'games'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

