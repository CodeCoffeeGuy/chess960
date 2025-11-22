'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Chess } from 'chess.js';
import { Chess960Board, type PieceType } from '@chess960/board';
import { useTheme } from '@/contexts/ThemeContext';
import { BulletStyleClock } from '@/components/chess/BulletStyleClock';
import { MatchmakingQueue } from '@/components/game/MatchmakingQueue';
import { GameResultModal } from '@/components/game/GameResultModal';
import { GameChat } from '@/components/game/GameChat';
import { PlayerHoverCard } from '@/components/game/PlayerHoverCard';
import { MoveList } from '@/components/game/MoveList';
import { OpeningDisplay } from '@/components/game/OpeningDisplay';
import { ArrowsControl } from '@/components/chess/ArrowsControl';
import { PromotionDialog } from '@/components/chess/PromotionDialog';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGame } from '@/hooks/useGame';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { TimeControl } from '@chess960/proto';
import { useRef } from 'react';
import { LagDetector } from '@chess960/redis-client';
import { MaintenanceMode } from '@/components/MaintenanceMode';

function PlayPageContent() {
  const searchParams = useSearchParams();
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>('1+0');
  const [isRated, setIsRated] = useState(true);
  const [isLightMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false); // Start as false since we handle auth immediately
  const [showResultModal, setShowResultModal] = useState(false);
  const [isBoardFlipped, setIsBoardFlipped] = useState(false);
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null); // null means live position
  const [arrowCount, setArrowCount] = useState(0);
  const [clearArrowsFn, setClearArrowsFn] = useState<(() => void) | null>(null);
  const [_lagStats, setLagStats] = useState<any>(null);
  const lagDetector = useRef(new LagDetector());
  const [gameResultData, setGameResultData] = useState<{
    whiteRatingBefore: number;
    whiteRatingAfter: number;
    blackRatingBefore: number;
    blackRatingAfter: number;
  } | null>(null);

  // Convert UCI moves to SAN notation for display
  const convertMovesToSAN = (uciMoves: string[], initialFen?: string): string[] => {
    const chess = new Chess(initialFen); // Use Chess960 initial FEN if provided
    const sanMoves: string[] = [];

    for (const uciMove of uciMoves) {
      try {
        const from = uciMove.slice(0, 2);
        const to = uciMove.slice(2, 4);
        const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

        const move = chess.move({
          from,
          to,
          promotion,
        });

        if (move) {
          sanMoves.push(move.san);
        } else {
          // Fallback to UCI if conversion fails
          sanMoves.push(uciMove);
        }
      } catch {
        // Fallback to UCI if error
        sanMoves.push(uciMove);
      }
    }

    return sanMoves;
  };

  const {
    isConnected,
    connectionState,
    joinQueue,
    leaveQueue,
    makeMove,
    offerDraw,
    acceptDraw,
    declineDraw,
    offerTakeback,
    acceptTakeback,
    declineTakeback,
    resign,
    abort,
    offerRematch,
    acceptRematch,
    declineRematch,
    sendChatMessage,
    userId,
    userHandle
  } = useWebSocket();

  const {
    isInQueue,
    queueState,
    currentGame,
    gameState
  } = useGame();

  const { boardTheme, pieceSet } = useTheme();
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [boardArrows, setBoardArrows] = useState<Array<{ startSquare: string; endSquare: string; color?: string }>>([]);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('[PLAY] Checking authentication...');

      try {
        const hasAuthToken = document.cookie.includes('auth-token');
        console.log('[PLAY] Has existing auth-token cookie:', hasAuthToken);

        // ALWAYS try to sync with NextAuth session first
        // (NextAuth cookies are httpOnly and not readable by JavaScript, so we must try the API call)
        console.log('[PLAY] Attempting to sync with NextAuth session...');
        const syncResponse = await fetch('/api/auth/sync-token', {
          method: 'POST',
          credentials: 'include',
        });

        console.log('[PLAY] Sync response status:', syncResponse.status);

        if (syncResponse.ok) {
          // User has valid NextAuth session - sync successful
          const syncData = await syncResponse.json();
          console.log('[PLAY] Successfully synced! User:', syncData.handle);
          console.log('[PLAY] Token in response (first 30 chars):', syncData.token?.substring(0, 30) + '...');

          // Wait longer for cookie to be set
          await new Promise(resolve => setTimeout(resolve, 500));
          const cookieAfterSync = document.cookie;
          console.log('[PLAY] All cookies after sync:', cookieAfterSync);
          const hasAuthTokenAfterSync = cookieAfterSync.includes('auth-token');
          console.log('[PLAY] Auth token cookie present after sync:', hasAuthTokenAfterSync);

          if (hasAuthTokenAfterSync) {
            // Extract and log the actual token from cookie
            const matches = cookieAfterSync.match(/auth-token=([^;]+)/);
            if (matches && matches[1]) {
              console.log('[PLAY] Auth token from cookie (first 30 chars):', matches[1].substring(0, 30) + '...');
              console.log('[PLAY] Token length:', matches[1].length);
            }
          } else {
            console.warn('[PLAY]  Token not found in cookies after sync - retrying in 1 second');
            // Retry once if token isn't in cookies yet
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryCheck = document.cookie.includes('auth-token');
            console.log('[PLAY] Retry check - auth-token present:', retryCheck);
          }
        } else if (syncResponse.status === 401) {
          // No NextAuth session - user not logged in
          console.log('[PLAY] No NextAuth session found (401)');

          if (!hasAuthToken) {
            // No NextAuth session and no auth token - create guest session
            console.log('[PLAY] Creating guest session...');
            const response = await fetch('/api/auth/guest', {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              throw new Error('Failed to create guest session');
            }

            const data = await response.json();
            console.log('[PLAY] Guest session created:', data.user);

            // Wait for guest token to be set
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log('[PLAY] Using existing guest auth token');
          }
        } else {
          // Some other error
          console.error('[PLAY] Unexpected sync response status:', syncResponse.status);

          if (!hasAuthToken) {
            // Fallback to guest session
            console.log('[PLAY] Creating guest session as fallback...');
            const response = await fetch('/api/auth/guest', {
              method: 'POST',
              credentials: 'include',
            });

            if (response.ok) {
              const data = await response.json();
              console.log('[PLAY] Guest session created:', data.user);
              // Wait for guest token to be set
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        // Final verification that token exists before triggering WebSocket
        const finalCheck = document.cookie.includes('auth-token');

        if (!finalCheck) {
          console.error('[PLAY] No auth token found after all attempts!');
        }

        // Skip authentication loading state
        setIsAuthenticating(false);

        // Trigger WebSocket connection with longer delay to ensure token is ready
        setTimeout(() => {
          window.dispatchEvent(new Event('auth-complete'));
        }, 500);

      } catch (_error) {
        console.error('[PLAY] Failed to set up authentication:', _error);
        setIsAuthenticating(false);
      }
    };

    checkAuth();
  }, []); // Empty dependency array - run once on mount

  // Initialize with URL params
  useEffect(() => {
    const tc = searchParams.get('tc') as TimeControl;
    const rated = searchParams.get('rated');

    if (tc === '1+0' || tc === '2+0') {
      setSelectedTimeControl(tc);
    }
    if (rated !== null) {
      setIsRated(rated === 'true');
    }
  }, [searchParams]);

  // Auto-join queue when connected and params are set
  useEffect(() => {
    const autoJoin = searchParams.get('autoJoin');
    const tc = searchParams.get('tc') as TimeControl;
    const rated = searchParams.get('rated');

    console.log('Auto-join effect:', { autoJoin, tc, rated, isConnected, isInQueue, currentGame });

    if (autoJoin === 'true' && tc && rated !== null && isConnected && !isInQueue && !currentGame) {
      console.log('Auto-joining queue with params:', { tc, rated: rated === 'true' });
      joinQueue(tc as TimeControl);
    }
  }, [searchParams, isConnected, isInQueue, currentGame, joinQueue]);
  
  
  // Update lag stats periodically
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      const stats = lagDetector.current.getLagStats(userId);
      setLagStats(stats);
    }, 5000);

    return () => clearInterval(interval);
  }, [userId]);

  // Fetch game result data when game ends
  useEffect(() => {
    if (currentGame?.ended && currentGame?.result && currentGame?.id) {
      console.log('Game ended! Fetching result data for game:', currentGame.id);
      fetch(`/api/game/${currentGame.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.game) {
            console.log('Game result data fetched:', data.game);
            setGameResultData({
              whiteRatingBefore: data.game.whiteRatingBefore,
              whiteRatingAfter: data.game.whiteRatingAfter,
              blackRatingBefore: data.game.blackRatingBefore,
              blackRatingAfter: data.game.blackRatingAfter,
            });
          }
        })
        .catch(err => {
          console.error('Failed to fetch game result data:', err);
        });
    } else {
      // Reset when starting new game
      setGameResultData(null);
    }
  }, [currentGame?.ended, currentGame?.result, currentGame?.id]);

  // Show result modal when game ends
  useEffect(() => {
    if (currentGame?.ended && currentGame?.result) {
      console.log('Game ended! Result:', currentGame.result, 'Player color:', currentGame.color);
      // Small delay to let final move animation complete
      const timer = setTimeout(() => {
        console.log('Showing result modal');
        setShowResultModal(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Reset modal when starting new game
      setShowResultModal(false);
    }
  }, [currentGame?.ended, currentGame?.result]);

  // Reset viewing position when new moves are made (auto-follow live position)
  useEffect(() => {
    if (currentGame && !currentGame.ended) {
      setViewingMoveIndex(null);
    }
  }, [currentGame?.moves.length]);

  // Compute current FEN position based on moves and viewing index
  const currentPosition = useMemo(() => {
    if (!currentGame) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    
    const chess = new Chess(currentGame.initialFen || undefined);
    const movesToApply = viewingMoveIndex !== null && viewingMoveIndex >= 0
      ? currentGame.moves.slice(0, viewingMoveIndex + 1)
      : currentGame.moves || [];
    
    for (const uciMove of movesToApply) {
      try {
        const from = uciMove.slice(0, 2);
        const to = uciMove.slice(2, 4);
        const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
        chess.move({ from, to, promotion: promotion as any });
      } catch (e) {
        console.error('Error applying move:', e);
      }
    }
    
    return chess.fen();
  }, [currentGame?.moves, currentGame?.initialFen, viewingMoveIndex]);

  // Compute last move squares
  const lastMove = useMemo<[string, string] | null>(() => {
    if (!currentGame?.moves || currentGame.moves.length === 0) return null;
    
    const movesToCheck = viewingMoveIndex !== null && viewingMoveIndex >= 0
      ? currentGame.moves.slice(0, viewingMoveIndex + 1)
      : currentGame.moves;
    
    if (movesToCheck.length === 0) return null;
    const lastUciMove = movesToCheck[movesToCheck.length - 1];
    if (lastUciMove && lastUciMove.length >= 4) {
      return [lastUciMove.slice(0, 2), lastUciMove.slice(2, 4)];
    }
    return null;
  }, [currentGame?.moves, viewingMoveIndex]);


  // Handle board move
  const handleMove = (from: string, to: string, promotion?: 'p' | 'r' | 'n' | 'b' | 'q' | 'k') => {
    if (!currentGame || currentGame.ended) return;
    
    // Note: Premoves are handled by the Chess960Board component internally.
    // When it becomes the player's turn, the board will call this function automatically.
    // So we don't need to check for premoves here - if this function is called,
    // it means it's the player's turn (or a premove is being executed).

    // Check if it's a pawn promotion
    const chess = new Chess(currentPosition);
    const piece = chess.get(from as any);
    const isPawn = piece?.type === 'p';
    const targetRank = to[1];
    const isPromotion = isPawn && (
      (piece?.color === 'w' && targetRank === '8') ||
      (piece?.color === 'b' && targetRank === '1')
    );

    if (isPromotion && !promotion) {
      // Show promotion dialog
      setPendingPromotion({ from, to });
      setShowPromotionDialog(true);
      return;
    }

    // Make the move
    const moveUci = from + to + (promotion || '');
    makeMove(currentGame.id, moveUci, Date.now());
  };

  // Handle promotion selection
  const handlePromotionSelect = (piece: PieceType) => {
    // Only allow promotion to q, r, b, n (not p or k)
    if (piece !== 'q' && piece !== 'r' && piece !== 'b' && piece !== 'n') {
      return;
    }
    if (pendingPromotion) {
      handleMove(pendingPromotion.from, pendingPromotion.to, piece);
      setPendingPromotion(null);
      setShowPromotionDialog(false);
    }
  };

  // Compute board orientation
  const boardOrientation = useMemo(() => {
    if (isBoardFlipped) {
      return currentGame?.color === 'white' ? 'black' : 'white';
    }
    return currentGame?.color === 'white' ? 'white' : 'black';
  }, [isBoardFlipped, currentGame?.color]);

  // Update arrow count when arrows change
  useEffect(() => {
    setArrowCount(boardArrows.length);
  }, [boardArrows]);

  // Move navigation handlers
  const goToFirstMove = () => {
    setViewingMoveIndex(0);
  };

  const goToPreviousMove = () => {
    if (!currentGame?.moves || currentGame.moves.length === 0) return;
    if (viewingMoveIndex === null) {
      // From live position, go to last move
      setViewingMoveIndex(currentGame.moves.length - 1);
    } else if (viewingMoveIndex > 0) {
      setViewingMoveIndex(viewingMoveIndex - 1);
    }
  };

  const goToNextMove = () => {
    if (!currentGame?.moves || currentGame.moves.length === 0) return;
    if (viewingMoveIndex === null) return; // Already at live position
    if (viewingMoveIndex < currentGame.moves.length - 1) {
      setViewingMoveIndex(viewingMoveIndex + 1);
    } else {
      // Go back to live position
      setViewingMoveIndex(null);
    }
  };

  const goToLastMove = () => {
    setViewingMoveIndex(null); // null = live position
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    // Navigation
    onFirstMove: goToFirstMove,
    onPreviousMove: goToPreviousMove,
    onNextMove: goToNextMove,
    onLastMove: goToLastMove,

    // Board controls
    onFlipBoard: () => setIsBoardFlipped(!isBoardFlipped),
    onEscape: () => {
      // Cancel premoves, clear selection, go back to live position
      setViewingMoveIndex(null);
      setBoardArrows([]);
    },

    // Game actions (only when game is active)
    onOfferDraw: currentGame && !currentGame.ended ? () => offerDraw(currentGame.id) : undefined,
    onResign: currentGame && !currentGame.ended ? () => resign(currentGame.id) : undefined,
    onAbort: currentGame && !currentGame.ended && currentGame.moves.length < 2 ? () => abort(currentGame.id) : undefined,

    // Disabled when no game or in queue
    disabled: !currentGame || isInQueue,
  });


  const handleLeaveQueue = () => {
    if (isInQueue) {
      leaveQueue();
    }
    // Redirect back to landing page
    window.location.href = '/';
  };

  // No authentication timeout needed - we set up immediately

  if (isAuthenticating) {
    return (
      <div
        className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: isLightMode ? '#f5f1ea' : '#1f1d1a', color: isLightMode ? '#000' : '#fff' }}
        suppressHydrationWarning
      >
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
            {/* Dark mode grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
            {/* Light mode grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
          </div>
        </div>

        <div
          className="relative max-w-md w-full bg-[#2a2723]/70 light:bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-[#3e3a33] light:border-[#d4caba] p-8 text-center"
          style={{
            backgroundColor: isLightMode ? 'rgba(255,255,255,0.7)' : 'rgba(42,39,35,0.7)',
            borderColor: isLightMode ? '#d4caba' : '#3e3a33'
          }}
          suppressHydrationWarning
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-300 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-white light:text-black mb-2" suppressHydrationWarning>
            Setting Up Guest Account
          </h2>
          <p className="text-[#b6aea2] light:text-[#5a5449]" suppressHydrationWarning>
            This should only take a moment...
          </p>
        </div>
      </div>
    );
  }

  if (!isConnected && connectionState !== 'error') {
    return (
      <div
        className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: isLightMode ? '#f5f1ea' : '#1f1d1a', color: isLightMode ? '#000' : '#fff' }}
        suppressHydrationWarning
      >
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
            {/* Dark mode grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
            {/* Light mode grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
          </div>
        </div>

        <div
          className="relative max-w-md w-full bg-[#2a2723]/70 light:bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-[#3e3a33] light:border-[#d4caba] p-8 text-center"
          style={{
            backgroundColor: isLightMode ? 'rgba(255,255,255,0.7)' : 'rgba(42,39,35,0.7)',
            borderColor: isLightMode ? '#d4caba' : '#3e3a33'
          }}
          suppressHydrationWarning
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-300 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-orange-300 to-orange-400 bg-clip-text text-transparent mb-2">
            Connecting to Game Server
          </h2>
          <p className="text-[#b6aea2] light:text-[#5a5449] mb-4" suppressHydrationWarning>
            Establishing real-time connection...
          </p>
        </div>
      </div>
    );
  }

  if (currentGame) {
    console.log('RENDERING GAME - Current game state:', {
      id: currentGame.id,
      color: currentGame.color,
      opponent: currentGame.opponent,
      movesCount: currentGame.moves?.length || 0,
      moves: currentGame.moves,
      timeLeft: currentGame.timeLeft,
      toMove: currentGame.toMove,
    });
    return (
      <>
        <MaintenanceMode />
        <div className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex flex-col">
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0">
          {/* Subtle grid */}
          <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
            {/* Dark mode grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
            {/* Light mode grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
          </div>
        </div>

        {/* Minimal Top Bar - MOBILE OPTIMIZED */}
        <div className="relative bg-[#3c3936]/80 light:bg-white/80 backdrop-blur-sm border-b border-[#4f4a44] light:border-[#d4caba] px-3 sm:px-6 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-6">
            <div className="text-xs sm:text-sm font-medium text-white light:text-black">{selectedTimeControl}</div>
            <div className="text-[10px] sm:text-xs text-[#a0958a] light:text-[#5a5449] bg-[#4f4a44] light:bg-[#f5f1ea] px-2 py-1 rounded">
              {isRated ? 'Rated' : 'Casual'}
            </div>
          </div>
          <div className="text-[10px] sm:text-xs text-[#a0958a] light:text-[#5a5449] font-mono">
            #{currentGame.id.slice(0, 8)}
          </div>
        </div>

        {/* Professional Game Layout - THREE COLUMN LAYOUT */}
        <div className="relative flex-1 flex items-center justify-center p-3 sm:p-6 bg-gradient-to-br from-[#262421] to-[#1a1816] light:from-[#f5f1ea] light:to-[#ebe7dc]">
          <div className="w-full flex flex-col lg:flex-row items-start lg:items-center justify-center gap-4 lg:gap-6 max-w-[1800px]">

            {/* LEFT COLUMN: Chat - Hidden on mobile, shown on desktop */}
            <div className="hidden lg:block w-[320px] flex-shrink-0">
              <div className="h-[400px] flex flex-col">
                <GameChat
                  messages={currentGame.chatMessages || []}
                  playerColor={currentGame.color}
                  onSendMessage={(message) => sendChatMessage(currentGame.id, message)}
                  gameEnded={currentGame.ended}
                />
              </div>
            </div>

            {/* CENTER COLUMN: Chess Board with Player Cards */}
            <div className="flex flex-col items-center w-full lg:w-auto flex-shrink-0">

              {/* Opponent Card - SIMPLIFIED */}
              <div className="w-full lg:w-[700px] bg-[#2a2825]/90 light:bg-white/90 backdrop-blur-sm border-2 border-[#3a3632] light:border-[#d4caba] rounded-xl px-6 py-4 shadow-xl mb-3">
                <div className="flex items-center justify-between gap-6">
                  {/* Opponent info */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 ${currentGame.color === 'white' ? 'bg-[#1a1a1a] border-2 border-gray-600' : 'bg-white border-2 border-gray-300'}`}></div>
                    <PlayerHoverCard
                      handle={currentGame.opponent?.handle || 'Anonymous'}
                      rating={currentGame.opponent?.rating || 1500}
                    >
                      <div className="cursor-pointer hover:text-orange-300 transition-colors">
                        <div className="text-base font-bold text-white light:text-black">
                          {currentGame.opponent?.handle || 'Anonymous'}
                        </div>
                        <div className="text-sm text-gray-400 light:text-[#5a5449]">
                          {currentGame.opponent?.rating || 1500}
                        </div>
                      </div>
                    </PlayerHoverCard>
                  </div>

                  {/* Opponent's clock */}
                  <div className="flex-shrink-0">
                    {currentGame.timeLeft && (
                      <BulletStyleClock
                        millis={Math.max(0, gameState.getOpponentTime())}
                        color={currentGame.color === 'white' ? 'black' : 'white'}
                        position="top"
                        running={
                          !currentGame.ended &&
                          currentGame.toMove === (currentGame.color === 'white' ? 'black' : 'white') &&
                          (
                            (currentGame.toMove === 'white' && currentGame.moves.length >= 1) ||
                            (currentGame.toMove === 'black' && currentGame.moves.length >= 2)
                          )
                        }
                        showBar={false}
                        onFlag={() => {}}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Chess Board - BIGGER FOR LAPTOP */}
              <div className="relative w-full lg:w-[700px] lg:h-[700px] flex items-center justify-center">
                    <Chess960Board
                      fen={currentPosition}
                      orientation={boardOrientation}
                      width={640}
                      readOnly={currentGame.ended || viewingMoveIndex !== null}
                      showCoordinates={true}
                      theme={boardTheme}
                      pieceSet={pieceSet}
                      lastMove={lastMove}
                      currentPlayerColor={currentGame.color}
                      arrows={boardArrows}
                      onArrowsChange={setBoardArrows}
                      enablePremove={!currentGame.ended}
                      enableKeyboard={!currentGame.ended && viewingMoveIndex === null}
                      onMove={viewingMoveIndex === null ? handleMove : undefined}
                      onPromotionSelect={handlePromotionSelect}
                      animationDuration={200}
                      showDestinations={true}
                      rookCastle={true}
                      moveInputMode="both"
                      sounds={{
                        enabled: false, // Set to true when you add your own sound files to /public/sounds/
                        baseUrl: '/sounds',
                        files: {
                          move: 'move.mp3',
                          capture: 'capture.mp3',
                          check: 'check.mp3',
                          castle: 'castle.mp3',
                          promotion: 'promote.mp3',
                        },
                      }}
                    />

                  {/* Board Controls */}
                  <div className="absolute -bottom-12 left-0 right-0 flex items-center justify-between px-2">
                  {/* Arrows Control */}
                  <div className="relative">
                    <ArrowsControl
                      arrowCount={arrowCount}
                      onClearArrows={() => {
                        setBoardArrows([]);
                        setClearArrowsFn(() => () => setBoardArrows([]));
                      }}
                    />
                  </div>

                  {/* Flip Board Button */}
                  <button
                    onClick={() => setIsBoardFlipped(!isBoardFlipped)}
                    className="bg-[#2a2825]/90 light:bg-white/90 hover:bg-[#35322e] light:hover:bg-[#f5f1ea] border-2 border-[#3a3632] light:border-[#d4caba] rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-300 light:text-[#5a5449] hover:text-white light:hover:text-black transition-all shadow-xl"
                    title="Flip board (F)"
                  >
                    <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Flip
                  </button>
                </div>
              </div>

              {/* Promotion Dialog */}
              <PromotionDialog
                isOpen={showPromotionDialog}
                playerColor={currentGame.color}
                onSelect={handlePromotionSelect}
                onCancel={() => {
                  setShowPromotionDialog(false);
                  setPendingPromotion(null);
                }}
              />

              {/* Player Card - SIMPLIFIED */}
              <div className="w-full lg:w-[700px] bg-[#2a2825]/90 light:bg-white/90 backdrop-blur-sm border-2 border-[#3a3632] light:border-[#d4caba] rounded-xl px-6 py-4 shadow-xl mt-3">
                <div className="flex items-center justify-between gap-6">
                  {/* Your info */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded-full flex-shrink-0 ${currentGame.color === 'white' ? 'bg-white border-2 border-gray-300' : 'bg-[#1a1a1a] border-2 border-gray-600'}`}></div>
                    <div>
                      <div className="text-base font-bold text-white light:text-black">
                        {userHandle || 'You'}
                      </div>
                      <div className="text-sm text-gray-400 light:text-[#5a5449]">
                        1500
                      </div>
                    </div>
                  </div>

                  {/* Your clock */}
                  <div className="flex-shrink-0">
                    {currentGame.timeLeft && (
                      <BulletStyleClock
                        millis={Math.max(0, gameState.getMyTime())}
                        color={currentGame.color}
                        position="bottom"
                        running={
                          !currentGame.ended &&
                          currentGame.toMove === currentGame.color &&
                          (
                            (currentGame.toMove === 'white' && currentGame.moves.length >= 1) ||
                            (currentGame.toMove === 'black' && currentGame.moves.length >= 2)
                          )
                        }
                        showBar={false}
                        onFlag={() => {}}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Moves List with Navigation - Hidden on mobile, shown on desktop */}
            <div className="hidden lg:flex lg:w-[320px] flex-shrink-0 self-stretch">
              <div className="w-full space-y-3 flex flex-col">
                {/* Draw Offer UI - If opponent offered */}
                {currentGame.drawOffer && currentGame.drawOffer !== currentGame.color && (
                  <div className="bg-orange-300/20 border-2 border-orange-300/50 rounded-xl p-4 shadow-xl">
                    <div className="text-center mb-3">
                      <div className="text-lg font-bold text-orange-300 mb-1">Draw Offered</div>
                      <div className="text-xs text-orange-200">Your opponent is offering a draw</div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => acceptDraw(currentGame.id)}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Accept Draw
                      </button>
                      <button
                        onClick={() => declineDraw(currentGame.id)}
                        className="flex-1 bg-orange-400 hover:bg-orange-300 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {/* Draw Offer Sent - If you offered */}
                {currentGame.drawOffer && currentGame.drawOffer === currentGame.color && (
                  <div className="bg-blue-600/20 border border-blue-500/40 rounded-lg p-3 text-center">
                    <div className="text-sm text-blue-300">Draw offer sent - waiting for opponent</div>
                  </div>
                )}

                {/* Takeback Offer UI - If opponent offered */}
                {currentGame.takebackOffer && currentGame.takebackOffer !== currentGame.color && (
                  <div className="bg-purple-600/20 border-2 border-purple-500/50 rounded-xl p-4 shadow-xl">
                    <div className="text-center mb-3">
                      <div className="text-lg font-bold text-purple-300 mb-1">Takeback Request</div>
                      <div className="text-xs text-purple-200">Your opponent wants to undo their last move</div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => acceptTakeback(currentGame.id)}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineTakeback(currentGame.id)}
                        className="flex-1 bg-orange-400 hover:bg-orange-300 text-white py-3 rounded-lg font-bold transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {/* Takeback Offer Sent - If you offered */}
                {currentGame.takebackOffer && currentGame.takebackOffer === currentGame.color && (
                  <div className="bg-blue-600/20 border border-blue-500/40 rounded-lg p-3 text-center">
                    <div className="text-sm text-blue-300">Takeback request sent - waiting for opponent</div>
                  </div>
                )}

                {/* Opening Name Display */}
                {(currentGame.opening || currentGame.chess960Position) && (
                  <OpeningDisplay
                    opening={currentGame.opening}
                    chess960Position={currentGame.chess960Position}
                  />
                )}


                {/* Moves List with Navigation */}
                <div className="bg-[#2a2825]/90 light:bg-white/90 backdrop-blur-sm border-2 border-[#3a3632] light:border-[#d4caba] rounded-xl p-3 shadow-xl flex-1 flex flex-col min-h-0">
                  <div className="text-xs font-semibold text-gray-400 light:text-[#5a5449] mb-2">
                    Moves {currentGame.moves?.length > 0 && `(${currentGame.moves.length})`}
                  </div>

                  {/* Moves list - scrollable */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#474239] light:scrollbar-thumb-[#d4caba] scrollbar-track-transparent min-h-0">
                    <MoveList
                      moves={currentGame.moves || []}
                      currentMoveIndex={viewingMoveIndex}
                      onMoveClick={(index) => setViewingMoveIndex(index)}
                      initialFen={currentGame.initialFen}
                    />
                  </div>

                  {/* Move Navigation Controls */}
                  <div className="mt-3 pt-3 border-t border-[#3a3632] light:border-[#d4caba]">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={goToFirstMove}
                        className="p-2 bg-[#35322e] light:bg-[#f5f1ea] hover:bg-[#3e3a36] light:hover:bg-[#e5e1da] border border-[#474239] light:border-[#d4caba] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="First move (Ctrl+Left)"
                        disabled={!currentGame.moves || currentGame.moves.length === 0}
                      >
                        <svg className="w-4 h-4 text-gray-300 light:text-[#5a5449]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={goToPreviousMove}
                        className="p-2 bg-[#35322e] light:bg-[#f5f1ea] hover:bg-[#3e3a36] light:hover:bg-[#e5e1da] border border-[#474239] light:border-[#d4caba] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous move (Left arrow)"
                        disabled={!currentGame.moves || currentGame.moves.length === 0}
                      >
                        <svg className="w-4 h-4 text-gray-300 light:text-[#5a5449]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={goToNextMove}
                        className="p-2 bg-[#35322e] light:bg-[#f5f1ea] hover:bg-[#3e3a36] light:hover:bg-[#e5e1da] border border-[#474239] light:border-[#d4caba] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next move (Right arrow)"
                        disabled={!currentGame.moves || currentGame.moves.length === 0 || viewingMoveIndex === null}
                      >
                        <svg className="w-4 h-4 text-gray-300 light:text-[#5a5449]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={goToLastMove}
                        className="p-2 bg-[#35322e] light:bg-[#f5f1ea] hover:bg-[#3e3a36] light:hover:bg-[#e5e1da] border border-[#474239] light:border-[#d4caba] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Last move (Ctrl+Right)"
                        disabled={!currentGame.moves || currentGame.moves.length === 0 || viewingMoveIndex === null}
                      >
                        <svg className="w-4 h-4 text-gray-300 light:text-[#5a5449]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-[#2a2825]/90 light:bg-white/90 backdrop-blur-sm border-2 border-[#3a3632] light:border-[#d4caba] rounded-xl p-3 shadow-xl">
                  <div className="flex flex-col space-y-2">
                    {/* Abort Button - Only available for first 2 moves */}
                    {currentGame.moves.length < 3 && !currentGame.ended && (
                      <button
                        onClick={() => {
                          if (confirm('Abort this game? (No rating change)')) {
                            abort(currentGame.id);
                          }
                        }}
                        className="w-full bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 border border-gray-600/50 py-2.5 rounded-lg text-sm font-bold transition-all"
                      >
                        Abort
                      </button>
                    )}

                    {/* Offer Draw Button - Only if game has started and no existing offer */}
                    {currentGame.moves.length >= 2 && !currentGame.drawOffer && !currentGame.ended && (
                      <button
                        onClick={() => offerDraw(currentGame.id)}
                        className="w-full bg-orange-300/20 hover:bg-orange-400/30 text-orange-300 border border-orange-400/50 py-2.5 rounded-lg text-sm font-bold transition-all"
                      >
                        Offer Draw
                      </button>
                    )}

                    {/* Request Takeback Button - Only if at least one move has been made, no existing takeback offer, and opponent allows takebacks */}
                    {currentGame.moves.length >= 1 && !currentGame.takebackOffer && !currentGame.ended && currentGame.opponent?.allowTakebacks !== false && (
                      <button
                        onClick={() => offerTakeback(currentGame.id)}
                        className="w-full bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/50 py-2.5 rounded-lg text-sm font-bold transition-all"
                      >
                        Request Takeback
                      </button>
                    )}

                    {/* Resign Button - Always available */}
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to resign?')) {
                          resign(currentGame.id);
                        }
                      }}
                      className="w-full bg-orange-400/20 hover:bg-orange-400/30 text-red-400 border border-orange-400/50 py-2.5 rounded-lg text-sm font-bold transition-all"
                    >
                      Resign
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MOBILE ONLY: Chat and Moves below board */}
            <div className="lg:hidden w-full space-y-3">
              {/* Mobile Moves List - Horizontal scroll */}
              <div className="bg-[#2a2825]/90 light:bg-white/90 backdrop-blur-sm border-2 border-[#3a3632] light:border-[#d4caba] rounded-xl p-3 shadow-xl">
                <div className="text-xs font-semibold text-gray-400 light:text-[#5a5449] mb-2">
                  Moves {currentGame.moves?.length > 0 && `(${currentGame.moves.length})`}
                </div>
                <div className="flex space-x-1.5 overflow-x-auto scrollbar-hide pb-1">
                  {!currentGame.moves || currentGame.moves.length === 0 ? (
                    <div className="text-xs text-gray-500 light:text-[#5a5449] text-center py-2 w-full">No moves yet</div>
                  ) : (
                    (() => {
                      const sanMoves = convertMovesToSAN(currentGame.moves, currentGame.initialFen);
                      return Array.from({ length: Math.ceil(sanMoves.length / 2) }).map((_, i) => {
                        const whiteMove = sanMoves[i * 2];
                        const blackMove = sanMoves[i * 2 + 1];
                        return (
                          <div key={i} className="flex-shrink-0 bg-[#35322e] light:bg-[#f5f1ea] rounded px-2 py-1 text-xs border border-[#474239] light:border-[#d4caba]">
                            <span className="text-gray-500 light:text-[#5a5449] mr-1">{i + 1}.</span>
                            <span className="text-white light:text-black font-mono">{whiteMove}</span>
                            {blackMove && <span className="text-white light:text-black font-mono ml-1.5">{blackMove}</span>}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>

              {/* Mobile Chat */}
              <div className="h-[300px]">
                <GameChat
                  messages={currentGame.chatMessages || []}
                  playerColor={currentGame.color}
                  onSendMessage={(message) => sendChatMessage(currentGame.id, message)}
                  gameEnded={currentGame.ended}
                />
              </div>

              {/* Mobile Action Buttons */}
              <div className="bg-[#2a2825]/90 light:bg-white/90 backdrop-blur-sm border-2 border-[#3a3632] light:border-[#d4caba] rounded-xl p-3 shadow-xl">
                <div className="flex space-x-3">
                  {currentGame.moves.length < 3 && !currentGame.ended && (
                    <button
                      onClick={() => {
                        if (confirm('Abort this game? (No rating change)')) {
                          abort(currentGame.id);
                        }
                      }}
                      className="flex-1 bg-gray-600/20 hover:bg-gray-600/30 text-gray-400 border border-gray-600/50 py-3 rounded-lg text-sm font-bold transition-all"
                    >
                      Abort
                    </button>
                  )}
                  {currentGame.moves.length >= 2 && !currentGame.drawOffer && !currentGame.ended && (
                    <button
                      onClick={() => offerDraw(currentGame.id)}
                      className="flex-1 bg-orange-300/20 hover:bg-orange-400/30 text-orange-300 border border-orange-400/50 py-3 rounded-lg text-sm font-bold transition-all"
                    >
                      Offer Draw
                    </button>
                  )}
                  {currentGame.moves.length >= 1 && !currentGame.takebackOffer && !currentGame.ended && currentGame.opponent?.allowTakebacks !== false && (
                    <button
                      onClick={() => offerTakeback(currentGame.id)}
                      className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-600/50 py-3 rounded-lg text-sm font-bold transition-all"
                    >
                      Takeback
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to resign?')) {
                        resign(currentGame.id);
                      }
                    }}
                    className="flex-1 bg-orange-400/20 hover:bg-orange-400/30 text-red-400 border border-orange-400/50 py-3 rounded-lg text-sm font-bold transition-all"
                  >
                    Resign
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Game Result Modal */}
        {showResultModal && currentGame.ended && gameResultData && (
          <GameResultModal
            result={currentGame.result}
            playerColor={currentGame.color}
            playerRatingBefore={
              currentGame.color === 'white'
                ? gameResultData.whiteRatingBefore
                : gameResultData.blackRatingBefore
            }
            playerRatingAfter={
              currentGame.color === 'white'
                ? gameResultData.whiteRatingAfter
                : gameResultData.blackRatingAfter
            }
            opponentHandle={currentGame.opponent?.handle || 'Anonymous'}
            opponentRatingBefore={
              currentGame.color === 'white'
                ? gameResultData.blackRatingBefore
                : gameResultData.whiteRatingBefore
            }
            onPlayAgain={() => {
              setShowResultModal(false);
              // Navigate back to queue
              window.location.href = '/?autoJoin=true&tc=' + selectedTimeControl + '&rated=' + isRated;
            }}
            onAnalyze={() => {
              window.location.href = `/game/${currentGame.id}/analysis`;
            }}
            onClose={() => {
              setShowResultModal(false);
            }}
            // Export data
            gameId={currentGame.id}
            moves={currentGame.moves}
            timeControl={selectedTimeControl}
            rated={isRated}
            whiteHandle={currentGame.color === 'white' ? userHandle : currentGame.opponent?.handle}
            blackHandle={currentGame.color === 'black' ? userHandle : currentGame.opponent?.handle}
            opening={currentGame.opening}
            // Rematch handlers
            onOfferRematch={() => offerRematch(currentGame.id)}
            onAcceptRematch={() => acceptRematch(currentGame.id)}
            onDeclineRematch={() => declineRematch(currentGame.id)}
            rematchOffered={!!currentGame.rematchOffer}
            rematchOfferFrom={currentGame.rematchOffer === currentGame.color ? 'me' : currentGame.rematchOffer ? 'opponent' : null}
          />
        )}
      </div>
      </>
    );
  }

  if (isInQueue) {
    return (
      <>
        <MaintenanceMode />
        <MatchmakingQueue
          queueState={queueState}
          timeControl={selectedTimeControl}
          isRated={isRated}
          onLeave={handleLeaveQueue}
        />
      </>
    );
  }

  // Check if autoJoin parameter exists
  const autoJoin = searchParams.get('autoJoin');

  // If no autoJoin parameter and not in queue/game, redirect to home
  // But don't redirect while connecting or if already in queue
  if (!autoJoin && !currentGame && !isInQueue && isConnected) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return null;
  }

  // Show loading state while setting up or waiting to join queue
  return (
    <>
      <MaintenanceMode />
      <div
        className="relative min-h-screen bg-[#1f1d1a] light:bg-[#f5f1ea] text-white light:text-black overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: isLightMode ? '#f5f1ea' : '#1f1d1a', color: isLightMode ? '#000' : '#fff' }}
        suppressHydrationWarning
      >
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]">
          {/* Dark mode grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] light:hidden" />
          {/* Light mode grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.08)_1px,transparent_1px)] bg-[size:40px_40px] hidden light:block" />
        </div>
      </div>

      <div
        className="relative max-w-md w-full bg-[#2a2723]/70 light:bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-[#3e3a33] light:border-[#d4caba] p-8 text-center"
        style={{
          backgroundColor: isLightMode ? 'rgba(255,255,255,0.7)' : 'rgba(42,39,35,0.7)',
          borderColor: isLightMode ? '#d4caba' : '#3e3a33'
        }}
        suppressHydrationWarning
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-300 mx-auto mb-4"></div>
        <h2 className="text-xl font-bold text-white light:text-black mb-2" suppressHydrationWarning>
          Preparing Match
        </h2>
        <p className="text-[#b6aea2] light:text-[#5a5449]" suppressHydrationWarning>
          {!isConnected ? 'Connecting to server...' : 'Setting up your game...'}
        </p>
      </div>
    </div>
    </>
  );
}

export default function PlayPageClient() {
  return (
    <Suspense fallback={null}>
      <PlayPageContent />
    </Suspense>
  );
}
