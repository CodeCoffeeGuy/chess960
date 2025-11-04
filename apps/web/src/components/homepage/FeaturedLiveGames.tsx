'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Chess960Board } from '@chess960/board';
import { useTheme } from '@/contexts/ThemeContext';
import { Chess } from 'chess.js';
import { Eye, TrendingUp } from 'lucide-react';
import { getRandomChess960Position } from '@chess960/utils';

// Helper component to compute current FEN from initial FEN and moves
function GameBoardPreview({ initialFen, moves }: { initialFen?: string; moves: string[] }) {
  const { boardTheme, pieceSet } = useTheme();
  const currentFen = useMemo(() => {
    try {
      const chess = new Chess(initialFen);
      for (const move of moves) {
        const from = move.slice(0, 2);
        const to = move.slice(2, 4);
        const promotion = move.length > 4 ? move[4] : undefined;
        try {
          chess.move({ from, to, promotion });
        } catch (error) {
          console.error('[GameBoardPreview] Invalid move:', move, error);
        }
      }
      return chess.fen();
    } catch (error) {
      console.error('[GameBoardPreview] Error computing FEN:', error);
      return initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
  }, [initialFen, moves]);

  return (
    <Chess960Board
      fen={currentFen}
      orientation="white"
      width={360}
      readOnly={true}
      showCoordinates={false}
      theme={boardTheme}
      pieceSet={pieceSet}
    />
  );
}

interface FeaturedGame {
  id: string;
  whiteHandle: string;
  blackHandle: string;
  whiteRating: number;
  blackRating: number;
  tc: string;
  chess960Position?: number;
  initialFen?: string;
  moves: string[];
  moveCount: number;
  spectatorCount: number;
  combinedRating: number;
}

export function FeaturedLiveGames() {
  const { boardTheme, pieceSet } = useTheme();
  const [games, setGames] = useState<FeaturedGame[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number[]>([0, 0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { on, isConnected } = useWebSocket();

  const intervalRefs = useRef<NodeJS.Timeout[]>([]);
  
  // Generate Chess960 positions for placeholders (consistent per board)
  // Wrap in try-catch to handle any import errors gracefully
  const [placeholderPositions] = useState(() => {
    try {
      if (typeof getRandomChess960Position === 'function') {
        return [
          getRandomChess960Position(),
          getRandomChess960Position(),
        ];
      }
      throw new Error('getRandomChess960Position not available');
    } catch (err) {
      console.error('Error generating placeholder positions:', err);
      // Fallback to standard position
      const fallbackFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      return [
        { position: 518, fen: fallbackFen, pieces: ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'] },
        { position: 518, fen: fallbackFen, pieces: ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'] },
      ];
    }
  });

  const fetchFeaturedGames = async () => {
    try {
      setError(null);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch('/api/games/featured', {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Error parsing featured games response:', jsonError);
          setError('Invalid response from server');
          setGames([]);
          setCurrentMoveIndex([]);
          setLoading(false);
          return;
        }
        
        // Even if response is not ok, try to get games array for graceful degradation
        if (!response.ok) {
          console.error('Featured games API error:', response.status);
          if (data.error) {
            setError(data.error);
          } else {
            setError(`API error: ${response.status}`);
          }
        }
        
        // Always set games, even if empty (enables placeholder rendering)
        if (data.games && Array.isArray(data.games)) {
          setGames(data.games);
          setCurrentMoveIndex(data.games.map(() => 0));
        } else {
          setGames([]);
          setCurrentMoveIndex([]);
        }
        setLoading(false);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Handle abort (timeout) specifically
        if (fetchError.name === 'AbortError') {
          console.error('Featured games API request timed out');
          setError('Request timed out. Please try again.');
        } else {
          throw fetchError; // Re-throw to outer catch
        }
        
        setGames([]);
        setCurrentMoveIndex([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching featured games:', error);
      setError('Failed to load featured games');
      setGames([]);
      setCurrentMoveIndex([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeaturedGames();
    const interval = setInterval(fetchFeaturedGames, 10000);
    
    // Fallback timeout: if loading state persists for more than 15 seconds, force it to false
    // This ensures placeholders always show even if something goes wrong
    const fallbackTimeout = setTimeout(() => {
      console.warn('Featured games loading timeout - forcing loading to false');
      setLoading(false);
      setError('Loading took longer than expected. Showing placeholder boards.');
    }, 15000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimeout);
    };
  }, []);

  // Present auto-play moves for each game
  useEffect(() => {
    intervalRefs.current.forEach(interval => clearInterval(interval));
    intervalRefs.current = [];

    games.forEach((game, gameIndex) => {
      if (game.moves.length === 0) return;

      const interval = setInterval(() => {
        setCurrentMoveIndex(prev => {
          const newIndex = [...prev];
          if (newIndex[gameIndex] < game.moves.length - 1) {
            newIndex[gameIndex] += 1;
          } else {
            newIndex[gameIndex] = 0;
          }
          return newIndex;
        });
      }, 1500);

      intervalRefs.current.push(interval);
    });

    return () => {
      intervalRefs.current.forEach(interval => clearInterval(interval));
    };
  }, [games]);

  // Subscribe to move updates via WebSocket
  useEffect(() => {
    if (!isConnected || !on || games.length === 0) return;

    const unsubscribeMoveMade = on('move.made', (message: any) => {
      setGames(prevGames => {
        const updatedGames = prevGames.map(game => {
          if (game.id === message.gameId) {
            return {
              ...game,
              moves: [...game.moves, message.uci],
              moveCount: game.moveCount + 1,
            };
          }
          return game;
        });
        return updatedGames;
      });
    });

    const unsubscribeGameEnd = on('game.end', (message: any) => {
      setGames(prevGames => {
        return prevGames.filter(game => game.id !== message.gameId);
      });
      fetchFeaturedGames();
    });

    return () => {
      unsubscribeMoveMade();
      unsubscribeGameEnd();
    };
  }, [isConnected, games, on]);

  // Create placeholder games if we don't have enough
  const displayGames = games.length > 0 
    ? games.slice(0, 2)
    : [
        { id: 'placeholder-1', isPlaceholder: true, position: placeholderPositions[0] },
        { id: 'placeholder-2', isPlaceholder: true, position: placeholderPositions[1] }
      ].slice(0, 2);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400"></div>
        </div>
      </div>
    );
  }

  // Always render the component, even if there's an error
  // The placeholder boards should still show

  return (
    <div className="max-w-7xl mx-auto px-4 pt-0 pb-4">
      {error && (
        <div className="text-center text-red-400 mb-3">
          <p className="text-sm">{error}</p>
        </div>
      )}
      {!error && games.length === 0 && (
        <div className="text-center text-[#a0958a] light:text-[#5a5449] mb-3">
          <p className="text-sm">No live games available at the moment</p>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayGames.map((game, gameIndex) => {
          // Handle placeholder games
          if ((game as any).isPlaceholder) {
            return (
              <div
                key={game.id}
                className="group flex flex-col bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 opacity-50"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#a0958a] light:text-[#5a5449]" />
                      <span className="text-xs font-semibold text-[#a0958a] light:text-[#5a5449]">
                        Waiting for games...
                      </span>
                    </div>
                    <span className="text-xs text-[#a0958a] light:text-[#5a5449] font-medium px-2 py-1 bg-[#35322e] light:bg-[#f5f1ea] rounded">
                      -
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="text-sm font-semibold text-[#a0958a] light:text-[#5a5449]">
                        -
                      </div>
                      <div className="text-xs text-[#a0958a] light:text-[#5a5449]">
                        -
                      </div>
                    </div>
                    <span className="text-[#a0958a] light:text-[#5a5449] mx-4">vs</span>
                    <div className="text-center flex-1">
                      <div className="text-sm font-semibold text-[#a0958a] light:text-[#5a5449]">
                        -
                      </div>
                      <div className="text-xs text-[#a0958a] light:text-[#5a5449]">
                        -
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mb-4">
                  <div className="flex justify-center">
                    <Chess960Board
                      fen={(game as any).position?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                      orientation="white"
                      width={360}
                      readOnly={true}
                      showCoordinates={false}
                      theme={boardTheme}
                      pieceSet={pieceSet}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#a0958a] light:text-[#5a5449] mt-auto pt-2 border-t border-[#3e3a33] light:border-[#d4caba]">
                  <span>- moves</span>
                  <span>- watching</span>
                </div>
              </div>
            );
          }

          // Handle real games
          const realGame = game as FeaturedGame;
          const currentMoves = realGame.moves.slice(0, currentMoveIndex[gameIndex] + 1);

          return (
            <div
              key={realGame.id}
              className="group flex flex-col bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-xl p-6 hover:border-orange-400/50 transition-all shadow-lg hover:shadow-xl"
            >
              {/* Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-semibold text-orange-400">
                      {realGame.combinedRating} combined
                    </span>
                  </div>
                  <span className="text-xs text-[#a0958a] light:text-[#5a5449] font-medium px-2 py-1 bg-[#35322e] light:bg-[#f5f1ea] rounded">
                    {realGame.tc}
                  </span>
                </div>

                {/* Players */}
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-sm font-semibold text-white light:text-black">
                      {realGame.whiteHandle}
                    </div>
                    <div className="text-xs text-[#a0958a] light:text-[#5a5449]">
                      {realGame.whiteRating}
                    </div>
                  </div>
                  <span className="text-[#a0958a] light:text-[#5a5449] mx-4">vs</span>
                  <div className="text-center flex-1">
                    <div className="text-sm font-semibold text-white light:text-black">
                      {realGame.blackHandle}
                    </div>
                    <div className="text-xs text-[#a0958a] light:text-[#5a5449]">
                      {realGame.blackRating}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chess Board - Smaller size, read-only */}
              <div className="flex justify-center mb-4">
                <Link
                  href={`/game/${realGame.id}/live`}
                  className="w-full flex justify-center"
                >
                  <GameBoardPreview
                    initialFen={realGame.initialFen}
                    moves={currentMoves}
                  />
                </Link>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-[#a0958a] light:text-[#5a5449] mt-auto pt-2 border-t border-[#3e3a33] light:border-[#d4caba]">
                <span>{realGame.moveCount} moves</span>
                <Link
                  href={`/game/${realGame.id}/live`}
                  className="flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors font-medium"
                >
                  <Eye className="h-3 w-3" />
                  <span>Watch Live</span>
                </Link>
                <span>{realGame.spectatorCount} watching</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
