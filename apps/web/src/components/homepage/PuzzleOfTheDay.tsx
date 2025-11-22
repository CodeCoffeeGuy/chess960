'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Chess960Board } from '@chess960/board';
import { useTheme } from '@/contexts/ThemeContext';
import { Puzzle } from 'lucide-react';

interface DailyPuzzle {
  id: string;
  gameId: string;
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
  initialFen?: string;
}

export function PuzzleOfTheDay() {
  const { boardTheme, pieceSet } = useTheme();
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [boardWidth, setBoardWidth] = useState(360);

  // Calculate responsive board width - match exactly with live game board
  useEffect(() => {
    const calculateWidth = () => {
      if (typeof window !== 'undefined') {
        // Match the live game board: use 85% of viewport width on mobile, max 360px
        // Use the same breakpoint (1024px) and calculation as FeaturedLiveGames
        const isMobile = window.innerWidth < 1024;
        const width = isMobile ? Math.min(Math.floor(window.innerWidth * 0.85), 360) : 360;
        setBoardWidth(width);
      }
    };

    // Calculate immediately
    calculateWidth();
    
    // Also calculate after a short delay to ensure window is fully loaded
    const timeoutId = setTimeout(calculateWidth, 100);
    
    window.addEventListener('resize', calculateWidth);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', calculateWidth);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    let fallbackTimeoutId: NodeJS.Timeout | null = null;

    const fetchPuzzle = async () => {
      try {
        console.log('[PuzzleOfTheDay] Starting fetch...');
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          console.warn('[PuzzleOfTheDay] Fetch timeout after 10s');
          controller.abort();
        }, 10000);

        const response = await fetch('/api/puzzle/daily', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        console.log('[PuzzleOfTheDay] Response status:', response.status);

        const data = await response.json();
        
        console.log('[PuzzleOfTheDay] API response:', { ok: response.ok, hasPuzzle: !!data.puzzle, data });
        
        if (!isMounted) {
          console.log('[PuzzleOfTheDay] Component unmounted, skipping state update');
          return;
        }

        if (response.ok && data.puzzle) {
          console.log('[PuzzleOfTheDay] Setting puzzle:', data.puzzle.id);
          setPuzzle(data.puzzle);
          setLoading(false);
        } else {
          // 404 or no puzzle - not an error, just no puzzle available yet
          console.warn('[PuzzleOfTheDay] No puzzle in response:', data);
          setPuzzle(null);
          setLoading(false);
        }
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        if (!isMounted) {
          console.log('[PuzzleOfTheDay] Component unmounted during error');
          return;
        }
        
        console.error('[PuzzleOfTheDay] Fetch error:', error);
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('[PuzzleOfTheDay] Request aborted (timeout or cancelled)');
        }
        setPuzzle(null);
        setLoading(false);
      }
    };

    fetchPuzzle();

    // Fallback timeout - ensure loading state is cleared after 5 seconds
    fallbackTimeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('[PuzzleOfTheDay] Fallback timeout after 5s - forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);
    };
  }, []);


  if (loading) {
    return (
      <div className="group flex flex-col h-full bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-4 hover:border-orange-400/50 transition-all shadow-lg hover:shadow-xl">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-[#a0958a] light:text-[#5a5449]" />
              <span className="text-xs font-semibold text-[#a0958a] light:text-[#5a5449]">
                Puzzle of the Day
              </span>
            </div>
            <span className="text-xs text-[#a0958a] light:text-[#5a5449] font-medium px-2 py-1 bg-[#35322e] light:bg-[#f5f1ea] rounded">
              -
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-[#a0958a] light:text-[#5a5449]">Loading puzzle...</div>
        </div>
        <div className="flex items-center justify-between text-xs text-[#a0958a] light:text-[#5a5449] mt-auto pt-2 border-t border-[#3e3a33] light:border-[#d4caba]">
          <span>Daily Puzzle</span>
          <span className="text-[#a0958a] light:text-[#5a5449]">-</span>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="group flex flex-col h-full bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-4 hover:border-orange-400/50 transition-all shadow-lg hover:shadow-xl">
        <div className="mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-[#a0958a] light:text-[#5a5449]" />
              <span className="text-xs font-semibold text-[#a0958a] light:text-[#5a5449]">
                Puzzle of the Day
              </span>
            </div>
            <span className="text-xs text-[#a0958a] light:text-[#5a5449] font-medium px-2 py-1 bg-[#35322e] light:bg-[#f5f1ea] rounded">
              -
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="text-center text-[#a0958a] light:text-[#5a5449]">
            <p className="mb-2">No puzzle available</p>
            <p className="text-sm font-medium text-orange-400">Coming Soon</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-[#a0958a] light:text-[#5a5449] mt-auto pt-2 border-t border-[#3e3a33] light:border-[#d4caba]">
          <span>Daily Puzzle</span>
          <span className="text-[#a0958a] light:text-[#5a5449]">-</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col h-full bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-4 hover:border-orange-400/50 transition-all shadow-lg hover:shadow-xl w-full min-w-0 max-w-full box-border overflow-hidden">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Puzzle className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-semibold text-orange-400">
              Puzzle of the Day
            </span>
          </div>
          <span className="text-xs text-[#a0958a] light:text-[#5a5449] font-medium px-2 py-1 bg-[#35322e] light:bg-[#f5f1ea] rounded">
            {puzzle.rating}
          </span>
        </div>
      </div>

      {/* Chess Board - Same size and style as featured game, responsive */}
      <div className="flex justify-center mb-3 flex-1 items-center">
        <Link
          href="/puzzle/daily"
          className="w-full flex justify-center"
        >
          <div className="flex justify-center">
            <Chess960Board
              fen={puzzle.fen}
              orientation="white"
              width={boardWidth}
              readOnly={true}
              showCoordinates={false}
              theme={boardTheme}
              pieceSet={pieceSet}
            />
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[#a0958a] light:text-[#5a5449] mt-auto pt-2 border-t border-[#3e3a33] light:border-[#d4caba]">
        <span>Daily Puzzle</span>
        <Link
          href="/puzzle/daily"
          className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors font-medium"
        >
          <span>Solve</span>
        </Link>
      </div>
    </div>
  );
}

