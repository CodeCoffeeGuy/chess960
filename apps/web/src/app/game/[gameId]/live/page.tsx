'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Chess960Board } from '@chess960/board';
import { useTheme } from '@/contexts/ThemeContext';
import { Chess } from 'chess.js';
import { getChess960Position } from '@chess960/utils';
import Link from 'next/link';
import { ArrowLeft, Users, Clock } from 'lucide-react';

interface GameLivePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

interface GameState {
  id: string;
  whiteId: string;
  blackId: string;
  whiteHandle: string;
  blackHandle: string;
  moves: string[];
  timeLeft: {
    white: number;
    black: number;
  };
  toMove: 'white' | 'black';
  tc: string;
  chess960Position?: number;
  initialFen?: string;
  result: string | null;
  ended: boolean;
}

export default function GameLivePage({ params }: GameLivePageProps) {
  const { gameId } = use(params);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [isSpectating, setIsSpectating] = useState(false);
  const { on, send, isConnected } = useWebSocket();


  // Fetch initial game data
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const response = await fetch(`/api/game/${gameId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch game data');
        }
        const data = await response.json();
        const game = data.game;

        // Check if game is live
        if (game.endedAt) {
          // Redirect to analysis page if game is finished
          window.location.href = `/game/${gameId}/analysis`;
          return;
        }

        // Get Chess960 initial FEN if applicable
        let initialFen: string | undefined;
        if (game.variant === 'CHESS960' && game.chess960Position) {
          try {
            const pos = getChess960Position(game.chess960Position);
            initialFen = pos.fen;
          } catch (e) {
            console.error('Error getting Chess960 position:', e);
          }
        }

        setGameState({
          id: game.id,
          whiteId: game.whiteId,
          blackId: game.blackId,
          whiteHandle: game.whiteHandle,
          blackHandle: game.blackHandle,
          moves: game.moves || [],
          timeLeft: {
            white: 0,
            black: 0,
          },
          toMove: 'white',
          tc: game.tc,
          chess960Position: game.chess960Position,
          initialFen,
          result: null,
          ended: false,
        });

        // Fetch spectator count
        const specResponse = await fetch(`/api/game/${gameId}/spectate`);
        if (specResponse.ok) {
          const specData = await specResponse.json();
          setSpectatorCount(specData.spectators?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching game:', err);
        setError('Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [gameId]);

  // Subscribe to game updates via WebSocket
  useEffect(() => {
    if (!isConnected || !gameState || !gameId) return;

    // Subscribe to spectate
    send({
      t: 'game.spectate',
      gameId,
    });
    setIsSpectating(true);

    // Subscribe to game state updates
    const unsubscribeGameState = on('game.state', (message: any) => {
      if (message.gameId === gameId) {
        setGameState((prev) => ({
          ...(prev || {} as GameState),
          moves: message.moves || [],
          timeLeft: message.timeLeft || prev?.timeLeft || { white: 0, black: 0 },
          toMove: message.toMove || 'white',
          result: message.result,
          ended: message.ended || false,
        }));
      }
    });

    // Subscribe to move updates
    const unsubscribeMoveMade = on('move.made', (message: any) => {
      if (message.gameId === gameId) {
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            moves: [...(prev.moves || []), message.uci],
            timeLeft: message.timeLeft || prev.timeLeft,
            toMove: prev.toMove === 'white' ? 'black' : 'white',
          };
        });
      }
    });

    // Subscribe to game end
    const unsubscribeGameEnd = on('game.end', (message: any) => {
      if (message.gameId === gameId) {
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            result: message.result,
            ended: true,
          };
        });
        // Redirect to analysis after a short delay
        setTimeout(() => {
          window.location.href = `/game/${gameId}/analysis`;
        }, 3000);
      }
    });

    // Cleanup
    return () => {
      unsubscribeGameState();
      unsubscribeMoveMade();
      unsubscribeGameEnd();
      if (isSpectating) {
        send({
          t: 'game.unspectate',
          gameId,
        });
      }
    };
  }, [isConnected, gameId, gameState, send, on, isSpectating]);

  const { boardTheme, pieceSet } = useTheme();

  // Update chess position for display
  const currentPosition = useMemo(() => {
    if (!gameState?.moves || gameState.moves.length === 0) {
      return gameState?.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }

    const chessInstance = new Chess(gameState.initialFen || undefined);
    for (const uciMove of gameState.moves) {
      try {
        const from = uciMove.slice(0, 2);
        const to = uciMove.slice(2, 4);
        const promotion = uciMove.length === 5 ? uciMove[4] : undefined;
        chessInstance.move({ from, to, promotion: promotion as any });
      } catch (e) {
        console.error('Error applying move:', e);
      }
    }
    return chessInstance.fen();
  }, [gameState?.moves, gameState?.initialFen]);

  // Compute last move squares
  const lastMove = useMemo<[string, string] | null>(() => {
    if (!gameState?.moves || gameState.moves.length === 0) {
      return null;
    }
    const lastUciMove = gameState.moves[gameState.moves.length - 1];
    if (lastUciMove && lastUciMove.length >= 4) {
      return [lastUciMove.slice(0, 2), lastUciMove.slice(2, 4)];
    }
    return null;
  }, [gameState?.moves]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-[#a0958a] light:text-[#5a5449]">{error || 'Game not found'}</p>
          <Link href="/" className="mt-4 inline-block px-6 py-2 bg-orange-400 rounded-lg hover:bg-orange-300 text-black">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black">
      {/* Header */}
      <div className="bg-[#2a2926]/80 light:bg-white/90 backdrop-blur-md border-b border-[#3e3a33] light:border-[#d4caba] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/games/live"
            className="flex items-center gap-2 text-[#c1b9ad] light:text-[#5a5449] hover:text-orange-400 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Live Games</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-[#a0958a] light:text-[#5a5449]">
              <Users className="h-4 w-4" />
              <span>{spectatorCount} watching</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#a0958a] light:text-[#5a5449]">
              <Clock className="h-4 w-4" />
              <span>{gameState.tc}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Player Info */}
          <div className="space-y-4">
            {/* White Player */}
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#a0958a] light:text-[#5a5449]">White</span>
                <span className="text-sm font-semibold">
                  {formatTime(gameState.timeLeft.white)}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white light:text-black">
                {gameState.whiteHandle}
              </h3>
            </div>

            {/* Move List */}
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4 max-h-96 overflow-y-auto">
              <h4 className="text-sm font-semibold mb-3 text-[#a0958a] light:text-[#5a5449]">Moves</h4>
              <div className="space-y-1 font-mono text-sm">
                {gameState.moves.map((move, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-[#a0958a] light:text-[#5a5449] w-8">
                      {Math.floor(index / 2) + 1}.
                    </span>
                    {index % 2 === 0 && (
                      <span className="text-white light:text-black">{move}</span>
                    )}
                    {index % 2 === 1 && (
                      <span className="text-white light:text-black ml-4">{move}</span>
                    )}
                  </div>
                ))}
              </div>
              {gameState.moves.length === 0 && (
                <p className="text-sm text-[#a0958a] light:text-[#5a5449]">No moves yet</p>
              )}
            </div>
          </div>

          {/* Center - Chess Board */}
          <div className="flex flex-col items-center">
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4">
              <Chess960Board
                fen={currentPosition}
                orientation="white"
                width={480}
                readOnly={true}
                showCoordinates={true}
                theme={boardTheme}
                pieceSet={pieceSet}
                lastMove={lastMove}
              />
            </div>

            {gameState.ended && (
              <div className="mt-4 px-4 py-2 bg-orange-400 text-black rounded-lg font-semibold">
                Game ended: {gameState.result}
              </div>
            )}
          </div>

          {/* Right Panel - Black Player Info */}
          <div className="space-y-4">
            {/* Black Player */}
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#a0958a] light:text-[#5a5449]">Black</span>
                <span className="text-sm font-semibold">
                  {formatTime(gameState.timeLeft.black)}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white light:text-black">
                {gameState.blackHandle}
              </h3>
            </div>

            {/* Game Info */}
            <div className="bg-[#2a2926] light:bg-white border border-[#3e3a33] light:border-[#d4caba] rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-3 text-[#a0958a] light:text-[#5a5449]">Game Info</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#a0958a] light:text-[#5a5449]">Time Control:</span>
                  <span className="text-white light:text-black font-semibold">{gameState.tc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a0958a] light:text-[#5a5449]">Moves:</span>
                  <span className="text-white light:text-black font-semibold">{gameState.moves.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a0958a] light:text-[#5a5449]">Rated:</span>
                  <span className="text-white light:text-black font-semibold">
                    {gameState.rated ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
