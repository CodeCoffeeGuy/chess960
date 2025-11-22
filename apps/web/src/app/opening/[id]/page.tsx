'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Chess960Board } from '@chess960/board';
import { Chess } from 'chess.js';
import { ArrowLeft, Database, BarChart3, Gamepad2, ChevronLeft, ChevronRight, SkipBack, SkipForward } from 'lucide-react';
import { getChess960Position } from '@chess960/utils';

interface Opening {
  id: string;
  name: string;
  eco: string | null;
  moves: string;
  fen: string;
  chess960Position: number | null;
  gameCount: number;
  moveStats: MoveStat[];
}

interface MoveStat {
  id: string;
  move: string;
  moveNumber: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesDrawn: number;
  gamesLost: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  avgRating: number | null;
}

export default function OpeningDetailPage() {
  const params = useParams();
  const router = useRouter();
  const openingId = params.id as string;

  const [opening, setOpening] = useState<Opening | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFen, setCurrentFen] = useState<string>('');
  const [chess, setChess] = useState<Chess | null>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
  const [initialFen, setInitialFen] = useState<string>('');
  const [allMoves, setAllMoves] = useState<string[]>([]);
  const [boardWidth, setBoardWidth] = useState<number>(480);
  
  // Calculate board width based on screen size - match puzzle page
  useEffect(() => {
    const updateBoardWidth = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth < 1024;
        const width = isMobile ? Math.min(Math.floor(window.innerWidth * 0.85), 360) : 480;
        setBoardWidth(width);
      }
    };
    
    updateBoardWidth();
    window.addEventListener('resize', updateBoardWidth);
    return () => window.removeEventListener('resize', updateBoardWidth);
  }, []);

  useEffect(() => {
    if (openingId) {
      fetchOpening();
    }
  }, [openingId]);

  useEffect(() => {
    if (opening) {
      // Parse moves from opening
      const moves = opening.moves.split(' ').filter(m => m.trim().length > 0);
      setAllMoves(moves);
      
      // Get initial FEN - use Chess960 starting position if available
      let startFen: string;
      if (opening.chess960Position) {
        const chess960Pos = getChess960Position(opening.chess960Position);
        startFen = chess960Pos.fen;
      } else {
        // Standard chess starting position
        startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      
      setInitialFen(startFen);
      const initialChess = new Chess(startFen);
      setChess(initialChess);
      setCurrentFen(startFen);
      setCurrentMoveIndex(0);
    }
  }, [opening]);
  
  // Update board position when currentMoveIndex changes
  useEffect(() => {
    if (!chess || !initialFen || allMoves.length === 0) return;
    
    // Reset chess to initial position
    const tempChess = new Chess(initialFen);
    
    // Play moves up to currentMoveIndex
    for (let i = 0; i < currentMoveIndex && i < allMoves.length; i++) {
      const move = allMoves[i];
      try {
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const promotion = move.length > 4 ? move[4] : undefined;
        tempChess.move({ from, to, promotion });
      } catch (error) {
        console.error('Error playing move:', move, error);
        break;
      }
    }
    
    setCurrentFen(tempChess.fen());
    setChess(tempChess);
  }, [currentMoveIndex, initialFen, allMoves]);

  const fetchOpening = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/opening/${openingId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/opening');
          return;
        }
        throw new Error('Failed to fetch opening');
      }
      const data = await response.json();
      setOpening(data.opening);
    } catch (error) {
      console.error('Error fetching opening:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveClick = (moveIndex: number) => {
    // Go to the position after this move
    setCurrentMoveIndex(moveIndex + 1);
  };
  
  const goToFirst = () => {
    setCurrentMoveIndex(0);
  };
  
  const goToPrevious = () => {
    if (currentMoveIndex > 0) {
      setCurrentMoveIndex(currentMoveIndex - 1);
    }
  };
  
  const goToNext = () => {
    if (currentMoveIndex < allMoves.length) {
      setCurrentMoveIndex(currentMoveIndex + 1);
    }
  };
  
  const goToLast = () => {
    setCurrentMoveIndex(allMoves.length);
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't handle if typing in input
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentMoveIndex > 0) {
          setCurrentMoveIndex(currentMoveIndex - 1);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentMoveIndex < allMoves.length) {
          setCurrentMoveIndex(currentMoveIndex + 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentMoveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentMoveIndex(allMoves.length);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIndex, allMoves.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!opening) {
    return (
      <div className="min-h-screen bg-[#1a1814] light:bg-[#f5f1ea] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#a0958a] light:text-[#6b6560] text-lg mb-4">Opening not found</p>
          <Link href="/opening" className="text-[#f97316] hover:text-[#ea580c]">
            Back to Openings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/opening"
            className="inline-flex items-center gap-2 text-[#a0958a] light:text-[#6b6560] hover:text-white light:hover:text-black mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Openings
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent">{opening.name}</h1>
                {opening.chess960Position && (
                  <span className="px-3 py-1 text-sm bg-orange-500/20 light:bg-orange-100 border border-orange-500/30 light:border-orange-300 rounded text-orange-300 light:text-orange-600 font-semibold">
                    Position #{opening.chess960Position}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-[#a0958a] light:text-[#5a5449]">
                <div className="flex items-center gap-1">
                  <Gamepad2 className="w-4 h-4 text-orange-300" />
                  {opening.gameCount} {opening.gameCount === 1 ? 'game' : 'games'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Move Tree */}
          <div className="lg:col-span-3 order-1 lg:order-1">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              <h2 className="text-xl font-semibold text-white light:text-black mb-4 flex items-center gap-2">
                <Database className="w-5 h-5" />
                Move Tree
              </h2>
              <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto">
                {/* Show initial position */}
                <button
                  onClick={goToFirst}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    currentMoveIndex === 0
                      ? 'bg-orange-500/20 light:bg-orange-100 border border-orange-500/50 light:border-orange-300'
                      : 'bg-[#33302c] light:bg-[#f0ebe0] hover:bg-[#3a3632] light:hover:bg-[#e8e3d8]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white light:text-black">
                      Start Position
                    </span>
                  </div>
                </button>
                
                {/* Show moves */}
                {allMoves.map((move, index) => {
                  const moveStat = opening.moveStats.find(ms => ms.move === move);
                  const isActive = currentMoveIndex === index + 1;
                  
                  return (
                    <button
                      key={`move-${index}`}
                      onClick={() => handleMoveClick(index)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-orange-500/20 light:bg-orange-100 border border-orange-500/50 light:border-orange-300'
                          : 'bg-[#33302c] light:bg-[#f0ebe0] hover:bg-[#3a3632] light:hover:bg-[#e8e3d8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white light:text-black">
                          {index + 1}. {move}
                        </span>
                        {moveStat && (
                          <span className="text-xs text-[#a0958a] light:text-[#6b6560]">
                            {moveStat.gamesPlayed} games
                          </span>
                        )}
                      </div>
                      {moveStat && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-400">{moveStat.winRate}%</span>
                          <span className="text-yellow-400">{moveStat.drawRate}%</span>
                          <span className="text-red-400">{moveStat.lossRate}%</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center: Board */}
          <div className="lg:col-span-6 order-2 lg:order-2">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              {currentFen && (
                <div className="space-y-4">
                  <div className="flex justify-center mb-4 sm:mb-6">
                    <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-2 sm:p-4">
                      <Chess960Board
                        fen={currentFen}
                        orientation="white"
                        width={boardWidth}
                        readOnly={true}
                        showCoordinates={true}
                        lastMove={
                          currentMoveIndex > 0 && currentMoveIndex <= allMoves.length
                            ? (() => {
                                const move = allMoves[currentMoveIndex - 1];
                                return [
                                  move.substring(0, 2),
                                  move.substring(2, 4),
                                ] as [string, string];
                              })()
                            : null
                        }
                      />
                    </div>
                  </div>
                  
                  {/* Navigation Controls */}
                  <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                    <button
                      onClick={goToFirst}
                      disabled={currentMoveIndex === 0}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="First move (Home)"
                    >
                      <SkipBack className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={goToPrevious}
                      disabled={currentMoveIndex === 0}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Previous move (←)"
                    >
                      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-[#a0958a] light:text-[#6b6560] font-medium">
                      {currentMoveIndex === 0 ? 'Start' : `${currentMoveIndex}/${allMoves.length}`}
                    </span>
                    <button
                      onClick={goToNext}
                      disabled={currentMoveIndex >= allMoves.length}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Next move (→)"
                    >
                      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={goToLast}
                      disabled={currentMoveIndex >= allMoves.length}
                      className="p-1.5 sm:p-2 rounded-lg bg-[#2a2720] light:bg-[#f0ebe0] border border-[#474239] light:border-[#d4caba] text-[#c1b9ad] light:text-[#4a453e] hover:bg-[#35322e] light:hover:bg-[#e8e3d8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Last move (End)"
                    >
                      <SkipForward className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Statistics */}
          <div className="lg:col-span-3 order-3 lg:order-3">
            <div className="bg-[#35322e] light:bg-white border border-[#474239] light:border-[#d4caba] rounded-2xl p-4">
              <h2 className="text-xl font-semibold text-white light:text-black mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Statistics
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#a0958a] light:text-[#6b6560]">Total Games</span>
                    <span className="text-lg font-semibold text-white light:text-black">{opening.gameCount}</span>
                  </div>
                </div>
                {opening.moveStats.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white light:text-black mb-2">Top Moves</h3>
                    <div className="space-y-2">
                      {opening.moveStats
                        .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
                        .slice(0, 5)
                        .map((moveStat) => (
                          <div key={moveStat.id} className="flex items-center justify-between text-sm">
                            <span className="text-[#c1b9ad] light:text-[#4a453e]">{moveStat.move}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">{moveStat.winRate}%</span>
                              <span className="text-[#a0958a] light:text-[#6b6560]">
                                ({moveStat.gamesPlayed})
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

