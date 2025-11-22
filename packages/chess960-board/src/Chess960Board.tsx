/**
 * Chess960Board - A custom chess board component optimized for Chess960 (Fischer Random Chess)
 * Built from scratch for complete control over Chess960-specific behavior
 * 
 * Features:
 * - Native Chess960 support with proper FEN handling
 * - Correct piece placement (white at rank 1, black at rank 8)
 * - Theme support (board colors, piece sets)
 * - Read-only mode for spectator/featured games
 * - Smooth piece move animations (configurable duration)
 * - Ghost piece during drag
 * - Arrow drawing and square highlighting
 * - Premove support
 * - Promotion handling
 * - Clean, maintainable codebase
 * 
 * @packageDocumentation
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Chess960BoardProps, Piece, PieceType, Square } from './types';

// Component for animated piece
function AnimatedPiece({
  fromX,
  fromY,
  dx,
  dy,
  piece,
  squareSize,
  animationDuration,
  getPieceImage,
}: {
  fromX: number;
  fromY: number;
  dx: number;
  dy: number;
  piece: Piece;
  squareSize: number;
  animationDuration: number;
  getPieceImage: (piece: Piece) => string;
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip animation if duration is 0
    if (animationDuration === 0) {
      setIsAnimating(true);
      return;
    }
    
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
  }, [animationDuration]);

  return (
    <div
      ref={ref}
      className="absolute pointer-events-none"
      style={{
        left: `${fromX}px`,
        top: `${fromY}px`,
        width: squareSize,
        height: squareSize,
        transform: isAnimating ? `translate(${dx}px, ${dy}px)` : 'translate(0, 0)',
        transition: `transform ${animationDuration}ms ease-in-out`,
        zIndex: 100,
      }}
    >
      <img
        src={getPieceImage(piece)}
        alt={`${piece.color} ${piece.type}`}
        className="w-full h-full object-contain object-center select-none"
        draggable={false}
      />
    </div>
  );
}

const DEFAULT_BOARD_THEME = {
  light: '#f0d9b5',
  dark: '#b58863',
};

const DEFAULT_PIECE_SET = {
  path: 'cburnett',
};

export function Chess960Board({
  fen,
  orientation = 'white',
  width = 280,
  onMove,
  readOnly = false,
  showCoordinates = true,
  theme = DEFAULT_BOARD_THEME,
  pieceSet = DEFAULT_PIECE_SET,
  piecesBaseUrl = '/pieces',
  lastMove,
  selectedSquare: externalSelectedSquare,
  legalMoves = [],
  currentPlayerColor,
  arrows = [],
  onArrowsChange,
  enablePremove = false,
  onPromotionSelect,
  animationDuration = 200,
  showDestinations = true,
  snapToValidMoves = true,
  rookCastle = true,
  touchIgnoreRadius = 0,
  enableKeyboard = false,
  onKeyboardInput,
  sounds,
  moveInputMode = 'both',
  blindfold = false,
  enableResize = false,
  onResize,
  eraseArrowsOnClick = false,
}: Chess960BoardProps) {
  const [chess] = useState(() => new Chess(fen));
  const [boardState, setBoardState] = useState<Piece[][]>([]);
  const [previousBoardState, setPreviousBoardState] = useState<Piece[][]>([]);
  const [animatingPieces, setAnimatingPieces] = useState<Map<string, { from: Square; to: Square; piece: Piece }>>(new Map());
  const [capturedPieces, setCapturedPieces] = useState<Map<string, { square: Square; piece: Piece }>>(new Map());
  const [internalSelectedSquare, setInternalSelectedSquare] = useState<Square | null>(null);
  const [draggedPiece, setDraggedPiece] = useState<{ square: Square; piece: Piece } | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const [ghostPiecePosition, setGhostPiecePosition] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<Square, { backgroundColor: string }>>({});
  const [arrowStart, setArrowStart] = useState<Square | null>(null);
  const [isDrawingArrow, setIsDrawingArrow] = useState(false);
  const [premoves, setPremoves] = useState<Array<{ from: Square; to: Square }>>([]);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [keyboardInput, setKeyboardInput] = useState<string>('');
  const keyboardInputRef = useRef<string>('');
  const [internalWidth, setInternalWidth] = useState<number>(width);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number } | null>(null);
  
  // User interaction stats - track whether user prefers dragging or clicking
  // Default to dragging on desktop, clicking on touch devices
  const [userPrefersDrag, setUserPrefersDrag] = useState<boolean>(!('ontouchstart' in window));
  
  // Drag distance threshold - minimum pixels to move before starting drag (default 3px)
  const dragDistanceThreshold = 3;
  
  // Update internal width when prop changes
  useEffect(() => {
    setInternalWidth(width);
  }, [width]);
  
  // Use external selectedSquare for hints/display, but allow internal selection for user clicks
  // If user has selected a piece internally, use that; otherwise use external (for hints)
  const selectedSquare = internalSelectedSquare !== null ? internalSelectedSquare : (externalSelectedSquare !== undefined ? externalSelectedSquare : null);
  
  // Determine if drag should be enabled based on moveInputMode
  const isDragEnabled = moveInputMode === 'drag' || moveInputMode === 'both';
  const isClickEnabled = moveInputMode === 'click' || moveInputMode === 'both';
  
  
  // Check if king is in check
  const isInCheck = useCallback(() => {
    try {
      return chess.inCheck();
    } catch {
      return false;
    }
  }, [chess]);
  
  const inCheck = isInCheck();
  
  // Convert rank/file to square notation - defined early for use in callbacks
  const rankFileToSquare = useCallback((rank: number, file: number): Square => {
    const files = 'abcdefgh';
    const ranks = '87654321'; // rank 0 = rank 8, rank 7 = rank 1
    return `${files[file]}${ranks[rank]}`;
  }, []);
  
  // Get the square of the king in check
  const getKingInCheckSquare = useCallback((): Square | null => {
    if (!inCheck) return null;
    try {
      const turn = chess.turn();
      const board = chess.board();
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
          const piece = board[rank][file];
          if (piece && piece.type === 'k' && piece.color === turn) {
            return rankFileToSquare(rank, file);
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }, [chess, inCheck, rankFileToSquare]);
  
  const checkSquare = getKingInCheckSquare();

  // Parse FEN and convert to board state
  const parseFen = useCallback((fenString: string): Piece[][] => {
    const board: Piece[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    try {
      const chess = new Chess(fenString);
      const position = chess.board();
      
      // Convert chess.js board format to our format
      // chess.js: [rank8, rank7, ..., rank1] where rank8 is index 0
      // We want: [rank8, rank7, ..., rank1] for display
      position.forEach((rank, rankIndex) => {
        rank.forEach((square, fileIndex) => {
          if (square) {
            board[rankIndex][fileIndex] = {
              type: square.type as PieceType,
              color: square.color === 'w' ? 'white' : 'black',
            };
          }
        });
      });
    } catch (error) {
      console.error('[Chess960Board] Error parsing FEN:', fenString, error);
    }
    
    return board;
  }, []);

  // Convert square notation to rank/file (defined early for use in detectAndAnimateMoves)
  const squareToRankFile = useCallback((square: Square): { rank: number; file: number } => {
    const file = square.charCodeAt(0) - 97; // 'a' = 0
    const rank = 8 - parseInt(square[1]); // '8' = 0, '1' = 7
    return { rank, file };
  }, []);

  // Detect moves and set up animations - only animate the ONE actual move
  const detectAndAnimateMoves = useCallback((oldBoard: Piece[][], newBoard: Piece[][]) => {
    // Only animate if exactly ONE piece moved (to avoid re-animating old moves)
    let moveCount = 0;
    let capturedCount = 0;
    const animating = new Map<string, { from: Square; to: Square; piece: Piece }>();
    const captured = new Map<string, { square: Square; piece: Piece }>();
    
    // Track squares that had pieces removed
    const squaresWithRemovedPieces = new Map<Square, Piece>();
    
    // Track squares that have new pieces (or changed pieces)
    const squaresWithNewPieces = new Map<Square, Piece>();
    
    // First pass: identify squares where pieces disappeared or changed
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const oldPiece = oldBoard[rank]?.[file];
        const newPiece = newBoard[rank]?.[file];
        const square = rankFileToSquare(rank, file);
        
        if (oldPiece) {
          // Check if piece changed or disappeared
          if (!newPiece || newPiece.color !== oldPiece.color || newPiece.type !== oldPiece.type) {
            squaresWithRemovedPieces.set(square, oldPiece);
          }
        }
        
        if (newPiece) {
          // Check if piece is new or changed at this square
          if (!oldPiece || oldPiece.color !== newPiece.color || oldPiece.type !== newPiece.type) {
            squaresWithNewPieces.set(square, newPiece);
          }
        }
      }
    }
    
    // Only proceed if we have exactly one move (one removed piece, one or zero new pieces)
    // This prevents re-animating pieces that were already moved
    if (squaresWithRemovedPieces.size !== 1 || squaresWithNewPieces.size > 1) {
      // Too many changes - don't animate (likely a position reset or multiple moves)
      return;
    }
    
    // Second pass: match removed piece with new piece
    const matchedSquares = new Set<Square>();
    
    for (const [fromSquare, removedPiece] of squaresWithRemovedPieces.entries()) {
      let matched = false;
      
      // Look for this piece at a new location
      const candidates: Array<{ square: Square; piece: Piece; distance: number }> = [];
      
      for (const [toSquare, newPiece] of squaresWithNewPieces.entries()) {
        // Skip if this square is already matched
        if (matchedSquares.has(toSquare)) continue;
        
        // Check if pieces match (same color and type)
        if (removedPiece.color === newPiece.color && removedPiece.type === newPiece.type) {
          // Calculate distance (Manhattan distance)
          const fromCoords = squareToRankFile(fromSquare);
          const toCoords = squareToRankFile(toSquare);
          const distance = Math.abs(fromCoords.rank - toCoords.rank) + Math.abs(fromCoords.file - toCoords.file);
          candidates.push({ square: toSquare, piece: newPiece, distance });
        }
      }
      
      // Sort by distance (closest first) and take the best match
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.distance - b.distance);
        const bestMatch = candidates[0];
        
        // Only animate if the square actually changed
        if (bestMatch.square !== fromSquare) {
          const animKey = `${bestMatch.square}-${removedPiece.color}-${removedPiece.type}`;
          animating.set(animKey, {
            from: fromSquare,
            to: bestMatch.square,
            piece: removedPiece,
          });
          matchedSquares.add(bestMatch.square);
          matched = true;
          moveCount++;
        }
      }
      
      // If no match found, piece was captured
      if (!matched) {
        captured.set(fromSquare, { square: fromSquare, piece: removedPiece });
        capturedCount++;
      }
    }
    
    // Only set animations if we have exactly one move
    if (moveCount === 1 || (moveCount === 0 && capturedCount === 1)) {
      setAnimatingPieces(animating);
      setCapturedPieces(captured);
      
      // Clear animations after duration
      if (animating.size > 0 || captured.size > 0) {
        setTimeout(() => {
          setAnimatingPieces(new Map());
          setCapturedPieces(new Map());
        }, animationDuration);
      }
    }
  }, [rankFileToSquare, animationDuration, squareToRankFile]);

  // Update board state when FEN changes and detect moves for animation
  // Use refs to avoid infinite loops from state dependencies
  const boardStateRef = useRef<Piece[][]>(boardState);
  const previousBoardStateRef = useRef<Piece[][]>(previousBoardState);
  const lastFenRef = useRef<string | undefined>(undefined); // Start with undefined so first render always runs
  
  // Keep refs in sync with state (separate effects to avoid loops)
  useEffect(() => {
    boardStateRef.current = boardState;
  }, [boardState]);
  
  useEffect(() => {
    previousBoardStateRef.current = previousBoardState;
  }, [previousBoardState]);

  // Helper to normalize FEN for comparison (ignore move counters)
  const normalizeFen = useCallback((fenStr: string): string => {
    // Remove move counters at the end for comparison
    // FEN format: "position w/b castling enpassant halfmove fullmove"
    // We only care about the position part for visual comparison
    const parts = fenStr.split(' ');
    if (parts.length >= 4) {
      return parts.slice(0, 4).join(' ');
    }
    return fenStr;
  }, []);

  // Track if we have an optimistic update in progress
  const optimisticUpdateRef = useRef<boolean>(false);
  // Store the FEN before optimistic update so we can detect reverts
  const preOptimisticFenRef = useRef<string | undefined>(undefined);
  // Track if a drop was successfully handled (to prevent dragEnd from clearing state)
  const dropHandledRef = useRef<boolean>(false);

  useEffect(() => {
    // Normalize FENs for comparison (ignore move counters)
    const normalizedFen = fen ? normalizeFen(fen) : undefined;
    const normalizedLastFen = lastFenRef.current ? normalizeFen(lastFenRef.current) : undefined;
    
    
    // CRITICAL: If we have an optimistic update active, protect boardState from being overwritten
    if (optimisticUpdateRef.current && preOptimisticFenRef.current) {
      const currentChessFen = chess.fen();
      const currentNormalized = normalizeFen(currentChessFen);
      const preOptimisticFenNormalized = normalizeFen(preOptimisticFenRef.current);
      
      
      // If incoming FEN matches our optimistic chess instance, parent confirmed the move
      if (normalizedFen === currentNormalized && fen) {
        // Parent confirmed - clear optimistic flag but don't reload (already correct)
        optimisticUpdateRef.current = false;
        preOptimisticFenRef.current = undefined;
        // Update chess instance silently without reloading board
        chess.load(fen);
        lastFenRef.current = fen;
        return; // Don't update boardState - it's already correct
      }
      
          // If incoming FEN matches pre-optimistic FEN, it's trying to revert - reject it
          if (normalizedFen === preOptimisticFenNormalized) {
            // DO NOT update boardState - keep our optimistic position
        return; // Keep our optimistic boardState
      }
      
          // Incoming FEN is different - probably a new position, accept it
          optimisticUpdateRef.current = false;
      preOptimisticFenRef.current = undefined;
      // Fall through to update boardState normally
    }
    
    // Only run if FEN actually changed (but allow first render)
    if (normalizedFen === normalizedLastFen) {
      return;
    }
    
    // Update lastFenRef to the actual fen (not normalized) for next comparison
    lastFenRef.current = fen;
    
    if (fen) {
      try {
        // CRITICAL: If we have an optimistic update, protect boardState from being overwritten
        if (optimisticUpdateRef.current) {
          const currentChessFen = chess.fen();
          const currentNormalized = normalizeFen(currentChessFen);
          const preOptimisticFenNormalized = normalizeFen(preOptimisticFenRef.current || '');
          
          // If incoming FEN matches our optimistic chess instance, parent confirmed the move
          if (normalizedFen === currentNormalized) {
            // Parent confirmed - clear optimistic flag but don't reload (already correct)
            optimisticUpdateRef.current = false;
            preOptimisticFenRef.current = undefined;
            // Update chess instance silently without reloading board
            chess.load(fen);
            return; // Don't update boardState - it's already correct
          }
          
          // If incoming FEN matches pre-optimistic FEN, it's trying to revert - reject it
          if (normalizedFen === preOptimisticFenNormalized) {
            return; // Keep our optimistic boardState
          }
          
          // Incoming FEN is different - probably a new position, accept it
          optimisticUpdateRef.current = false;
          preOptimisticFenRef.current = undefined;
          // Fall through to update boardState normally
        }
        
        const previousFen = chess.fen();
        chess.load(fen);
        const newBoardState = parseFen(fen);
        
        // Use refs to get current state without adding to dependencies
        const currentBoardState = boardStateRef.current;
        const currentPreviousBoardState = previousBoardStateRef.current;
        
        // Only animate if we have a previous state and animations are enabled
        // AND the position actually changed (not just move counters)
        const normalizedPreviousFen = previousFen ? normalizeFen(previousFen) : undefined;
        if (currentPreviousBoardState.length > 0 && animationDuration > 0 && normalizedPreviousFen !== normalizedFen) {
          // Make a deep copy of previous state for comparison
          const prevBoardCopy = currentPreviousBoardState.map(rank => rank.map(piece => piece ? { ...piece } : null)) as Piece[][];
          detectAndAnimateMoves(prevBoardCopy, newBoardState);
        }
        
        // Update previous state to current before updating current
        const prevStateCopy = currentBoardState.length > 0 
          ? (currentBoardState.map(rank => rank.map(piece => piece ? { ...piece } : null)) as Piece[][])
          : newBoardState;
        setPreviousBoardState(prevStateCopy);
        setBoardState(newBoardState);
      } catch (error) {
        console.error('[Chess960Board] Error loading FEN:', fen, error);
        // Fallback to standard starting position
        chess.reset();
        const newBoardState = parseFen(chess.fen());
        const currentBoardState = boardStateRef.current;
        const prevStateCopy = currentBoardState.length > 0 
          ? (currentBoardState.map(rank => rank.map(piece => piece ? { ...piece } : null)) as Piece[][])
          : newBoardState;
        setPreviousBoardState(prevStateCopy);
        setBoardState(newBoardState);
      }
    } else {
      // If no FEN provided, use standard starting position
      chess.reset();
      const newBoardState = parseFen(chess.fen());
      const currentBoardState = boardStateRef.current;
      const prevStateCopy = currentBoardState.length > 0 
        ? (currentBoardState.map(rank => rank.map(piece => piece ? { ...piece } : null)) as Piece[][])
        : newBoardState;
      setPreviousBoardState(prevStateCopy);
      setBoardState(newBoardState);
    }
  }, [fen, animationDuration, detectAndAnimateMoves, chess, parseFen, normalizeFen]); // Only depend on fen and stable callbacks

  // Get square color (light or dark)
  const getSquareColor = useCallback((rank: number, file: number): 'light' | 'dark' => {
    return (rank + file) % 2 === 0 ? 'dark' : 'light';
  }, []);

  // State for right-click hover destination display
  const [rightClickHoverSquare, setRightClickHoverSquare] = useState<Square | null>(null);
  
  // Calculate legal moves for selected square
  const calculatedLegalMoves = useMemo(() => {
    if (!selectedSquare || readOnly || !showDestinations) return [];
    try {
      const moves = chess.moves({ square: selectedSquare as any, verbose: true });
      return moves.map((move: any) => move.to);
    } catch {
      return [];
    }
  }, [selectedSquare, chess, readOnly, showDestinations]);
  
  // Calculate legal moves for right-click hover (shows destinations on right-click)
  const rightClickLegalMoves = useMemo(() => {
    if (!rightClickHoverSquare || readOnly || !showDestinations) return [];
    try {
      const moves = chess.moves({ square: rightClickHoverSquare as any, verbose: true });
      return moves.map((move: any) => move.to);
    } catch {
      return [];
    }
  }, [rightClickHoverSquare, chess, readOnly, showDestinations]);
  
  // Use provided legalMoves or calculate them
  // Show destinations for selected square OR right-click hover square
  const effectiveLegalMoves = showDestinations 
    ? (selectedSquare 
        ? (legalMoves.length > 0 ? legalMoves : calculatedLegalMoves)
        : rightClickLegalMoves)
    : [];
  
  // Square to show destinations for (either selected or right-click hover)
  const destinationsSquare = selectedSquare || rightClickHoverSquare;

  // Sound helper function (defined early for use in handlers)
  const playSound = useCallback((soundType: 'move' | 'capture' | 'check' | 'castle' | 'promotion') => {
    if (!sounds?.enabled) return;
    
    const soundFiles = {
      move: sounds.files?.move || 'move.mp3',
      capture: sounds.files?.capture || 'capture.mp3',
      check: sounds.files?.check || 'check.mp3',
      castle: sounds.files?.castle || 'castle.mp3',
      promotion: sounds.files?.promotion || 'promote.mp3',
    };
    
    const baseUrl = sounds.baseUrl || '/sounds';
    const audio = new Audio(`${baseUrl}/${soundFiles[soundType]}`);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Silently fail if audio can't play (e.g., user hasn't interacted)
    });
  }, [sounds]);
  
  // Handle square click with rook castling support and arrow erase
  const handleSquareClick = useCallback((rank: number, file: number, event?: React.MouseEvent | React.TouchEvent) => {
    // Don't handle clicks if it was a right-click (button 2)
    if (event && 'button' in event && (event as React.MouseEvent).button === 2) {
      return; // Right-click is handled separately in handleRightClick
    }
    
    if (readOnly) return;
    
    // Allow piece selection even if onMove is undefined (for read-only viewing)
    // Only require onMove when actually making a move
    
    // Clear right-click hover destinations on left click
    setRightClickHoverSquare(null);
    
    // Check for arrow erase first
    if (eraseArrowsOnClick && arrows.length > 0 && onArrowsChange) {
      const square = rankFileToSquare(rank, file);
      // Check if click is on an arrow (check if square is start or end of any arrow)
      const clickedArrow = arrows.find(arrow => arrow.startSquare === square || arrow.endSquare === square);
      if (clickedArrow) {
        // Remove the clicked arrow
        const updatedArrows = arrows.filter(arrow => arrow !== clickedArrow);
        onArrowsChange(updatedArrows);
        return;
      }
    }
    
    if (!isClickEnabled) return;

    const square = rankFileToSquare(rank, file);
    
    // Check if this is a premove (not player's turn but premove enabled)
    const isPremove = enablePremove && currentPlayerColor && 
      chess.turn() !== (currentPlayerColor === 'white' ? 'w' : 'b');
    
    if (selectedSquare) {
      // Try to make a move
      if (selectedSquare !== square) {
        // Check if onMove is available - if not, just allow selection changes
        if (!onMove) {
          // No move handler - just allow selection changes
          const newPiece = boardState[rank]?.[file];
          if (newPiece) {
            // Try selecting the clicked piece instead
            setInternalSelectedSquare(square);
          } else {
            // Clicked empty square - clear selection
            setInternalSelectedSquare(null);
          }
          return;
        }
        
        // ALWAYS validate move with chess.js - don't trust effectiveLegalMoves alone
        try {
          const testChess = new Chess(chess.fen());
          const move = testChess.move({ from: selectedSquare as any, to: square });
          
          if (!move) {
            // Invalid move - deselect or select new piece
            const newPiece = boardState[rank]?.[file];
            if (newPiece) {
              // Try selecting the clicked piece instead
              setInternalSelectedSquare(square);
            } else {
              // Clicked empty square - clear selection
              setInternalSelectedSquare(null);
            }
            return;
          }
          
          // Move is valid - determine move type for sound
          const targetPiece = boardState[rank]?.[file];
          const isCapture = !!move.captured;
          const sourcePiece = chess.get(selectedSquare as any);
          const isPawn = sourcePiece?.type === 'p';
          const targetRank = square[1];
          const isPromotion = !!move.promotion;
          
          // Try to detect castling
          let isCastle = false;
          if (sourcePiece?.type === 'k') {
            const fileDiff = Math.abs(square.charCodeAt(0) - selectedSquare.charCodeAt(0));
            if (fileDiff === 2) {
              isCastle = true;
            }
          }
          
          const isCheck = testChess.inCheck();
          
          // Play appropriate sound
          if (isCastle) {
            playSound('castle');
          } else if (isPromotion) {
            playSound('promotion');
          } else if (isCheck) {
            playSound('check');
          } else if (isCapture) {
            playSound('capture');
          } else {
            playSound('move');
          }
          
          // Handle premove vs regular move
          const promotion = isPromotion ? (move.promotion as PieceType) : undefined;
          
          if (isPremove) {
            // Store as premove instead of calling onMove immediately
            setPremoves(prev => [...prev, { from: selectedSquare, to: square }]);
            
            // Clear selection after storing premove
            setInternalSelectedSquare(null);
          } else {
            // Regular move - call onMove immediately
            onMove(selectedSquare, square, promotion);
            
            // Clear selection after move
            setInternalSelectedSquare(null);
          }
        } catch (error) {
          // Invalid move - deselect or select new piece
          const newPiece = boardState[rank]?.[file];
          if (newPiece) {
            // Try selecting the clicked piece instead
            setInternalSelectedSquare(square);
          } else {
            // Clicked empty square - clear selection
            setInternalSelectedSquare(null);
          }
          return;
        }
      } else {
        // Clicked same square - deselect
        setInternalSelectedSquare(null);
      }
    } else {
      // Select a piece (or start premove)
      const piece = boardState[rank]?.[file];
      if (piece) {
        // Rook castling: if rook is clicked and rookCastle is enabled, try to castle
        if (rookCastle && piece.type === 'r') {
          // Check if it's the player's rook
          const pieceColor = piece.color === 'white' ? 'white' : 'black';
          // Allow castling for player's piece OR if premove is enabled
          const canCastle = !currentPlayerColor || pieceColor === currentPlayerColor || isPremove;
          if (canCastle) {
            try {
              // Find the king of the same color
              const kingRank = pieceColor === 'white' ? 7 : 0; // Rank 7 for white, 0 for black
              let kingSquare: Square | null = null;
              
              for (let f = 0; f < 8; f++) {
                const testSquare = rankFileToSquare(kingRank, f);
                const testPiece = chess.get(testSquare as any);
                if (testPiece && testPiece.type === 'k' && testPiece.color === (pieceColor === 'white' ? 'w' : 'b')) {
                  kingSquare = testSquare;
                  break;
                }
              }
              
              if (kingSquare) {
                // Check if castling is legal
                const moves = chess.moves({ square: kingSquare as any, verbose: true });
                const castlingMove = moves.find((move: any) => 
                  move.flags?.includes('k') || move.flags?.includes('q')
                );
                
                if (castlingMove) {
                  // Determine castling direction based on rook position
                  const rookFile = file;
                  const kingFile = kingSquare.charCodeAt(0) - 97;
                  const isKingside = rookFile > kingFile;
                  
                  // Find the correct castling move
                  const castleMove = moves.find((move: any) => {
                    const isKingSide = move.to.charCodeAt(0) > move.from.charCodeAt(0);
                    return (isKingside && isKingSide && move.flags?.includes('k')) ||
                           (!isKingside && !isKingSide && move.flags?.includes('q'));
                  });
                  
                  if (castleMove && onMove) {
                    playSound('castle');
                    onMove(kingSquare, castleMove.to);
                    setInternalSelectedSquare(null);
                    return;
                  }
                }
              }
            } catch (error) {
              // If castling check fails, fall through to normal selection
            }
          }
        }
        
        // Normal piece selection (or premove selection)
        // Allow selection if:
        // 1. It's the player's piece (normal move)
        // 2. Premove is enabled and it's not the player's turn (premove)
        const pieceColor = piece.color === 'white' ? 'white' : 'black';
        const isPlayerPiece = !currentPlayerColor || pieceColor === currentPlayerColor;
        const canSelect = isPlayerPiece || isPremove;
        
        if (canSelect) {
          // Select the piece - this shows destinations even for premoves
          // Always allow internal selection - external selectedSquare is just for hints/display
          setInternalSelectedSquare(square);
        }
      } else {
        // Clicked empty square - clear selection
        // Always allow clearing internal selection
        setInternalSelectedSquare(null);
      }
    }
  }, [readOnly, onMove, selectedSquare, rankFileToSquare, boardState, effectiveLegalMoves, externalSelectedSquare, rookCastle, currentPlayerColor, chess, playSound, isClickEnabled, eraseArrowsOnClick, arrows, onArrowsChange, enablePremove]);

  // Get piece image path - supports custom piece sets
  const getPieceImage = useCallback((piece: Piece): string => {
    const pieceCode = `${piece.color === 'white' ? 'w' : 'b'}${piece.type.toUpperCase()}`;
    const pieceSetPath = pieceSet?.path || 'cburnett';
    // If pieceSetPath already starts with '/', it's a full path - use it directly
    // Otherwise, combine with piecesBaseUrl
    if (pieceSetPath.startsWith('/')) {
      return `${pieceSetPath}/${pieceCode}.svg`;
    }
    return `${piecesBaseUrl}/${pieceSetPath}/${pieceCode}.svg`;
  }, [pieceSet, piecesBaseUrl]);

  const squareSize = internalWidth / 8;

  // Determine if it's the player's turn (for premove validation)
  const isPlayerTurn = useMemo(() => {
    if (!currentPlayerColor) return true; // Default to allowing moves if not specified
    try {
      return chess.turn() === (currentPlayerColor === 'white' ? 'w' : 'b');
    } catch {
      return true;
    }
  }, [chess, currentPlayerColor]);
  
  // Track previous turn state to detect when it BECOMES the player's turn
  const prevIsPlayerTurnRef = useRef<boolean>(isPlayerTurn);
  const premovesRef = useRef(premoves);
  
  // Keep premovesRef in sync with premoves state
  useEffect(() => {
    premovesRef.current = premoves;
  }, [premoves]);
  
  // Execute premoves when it becomes the player's turn (transition from false to true)
  useEffect(() => {
    // Update ref
    const wasPlayerTurn = prevIsPlayerTurnRef.current;
    prevIsPlayerTurnRef.current = isPlayerTurn;
    
    // Only execute if it just became the player's turn (transition from false to true)
    if (!enablePremove || premovesRef.current.length === 0 || !isPlayerTurn || wasPlayerTurn || !onMove || readOnly) {
      return;
    }
    
    // It just became the player's turn - try to execute the first premove
    const firstPremove = premovesRef.current[0];
    if (!firstPremove) return;
    
    // Check if the premove is still valid using current FEN
    try {
      const currentFen = fen || chess.fen();
      const testChess = new Chess(currentFen);
      const move = testChess.move({
        from: firstPremove.from,
        to: firstPremove.to,
        promotion: 'q', // Default promotion for pawns (will be handled by onMove if needed)
      });
      
      if (move) {
        // Premove is valid - execute it
        // Determine if it's a promotion
        const piece = testChess.get(firstPremove.from as any);
        const isPawn = piece?.type === 'p';
        const targetRank = firstPremove.to[1];
        const isPromotion = isPawn && (
          (piece?.color === 'w' && targetRank === '8') ||
          (piece?.color === 'b' && targetRank === '1')
        );
        
        // Execute the move via onMove callback
        onMove(firstPremove.from, firstPremove.to, isPromotion ? 'q' : undefined);
        
        // Remove this premove from the list
        setPremoves(prev => prev.slice(1));
        
        // Clear selection
        if (externalSelectedSquare === undefined) {
          setInternalSelectedSquare(null);
        }
      } else {
        // Premove is no longer valid - remove it
        setPremoves(prev => prev.slice(1));
      }
    } catch (error) {
      // Premove is invalid - remove it
      setPremoves(prev => prev.slice(1));
    }
  }, [isPlayerTurn, fen, enablePremove, onMove, readOnly, chess, externalSelectedSquare]);

  // Handle mouse/touch down on piece - start drag tracking
  // Clicks are handled by squares, drags are handled here
  const handlePieceMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent, rank: number, file: number) => {
    // Only handle left button clicks for mouse events
    if (e.type === 'mousedown' && (e as React.MouseEvent).button !== 0) return;
    
    // Only handle single touch
    if (e.type === 'touchstart' && (e as React.TouchEvent).touches.length > 1) return;
    
    // Only set up drag tracking if drag is enabled
    // If drag is disabled, clicks will be handled by onClick handlers
    if (readOnly || !isDragEnabled) {
      return;
    }

    const square = rankFileToSquare(rank, file);
    const piece = boardState[rank]?.[file];
    
    if (!piece) {
      return;
    }

    // Check if it's the player's piece
    if (currentPlayerColor) {
      const pieceColor = piece.color === 'white' ? 'white' : 'black';
      if (pieceColor !== currentPlayerColor) {
        // Allow dragging opponent's piece only if premove is enabled and not player's turn
        if (!enablePremove || isPlayerTurn) {
          return;
        }
      }
    }

    // Get event position for distance tracking
    let clientX: number;
    let clientY: number;
    if (e.type === 'mousedown') {
      const me = e as React.MouseEvent;
      clientX = me.clientX;
      clientY = me.clientY;
    } else {
      const te = e as React.TouchEvent;
      if (te.touches.length === 0) return;
      clientX = te.touches[0].clientX;
      clientY = te.touches[0].clientY;
    }

    // Store drag start position to detect if user actually dragged
    // Use distance threshold to distinguish clicks from drags
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (boardRect) {
      dragStartPosRef.current = {
        x: clientX,
        y: clientY,
      };
      hasMovedRef.current = false;
      
      // Store the piece info in the ref for potential drag
      // Also store origin target for touch event matching (to verify touchend matches touchstart)
      draggedPieceRef.current = { 
        square, 
        piece,
        originTarget: e.target as EventTarget | null,
      };
      
      // Reset key change tracking for new drag
      keyHasChangedRef.current = false;
      
      // If user has previously dragged, auto-start drag immediately
      if (userPrefersDrag && dragDistanceThreshold > 0) {
        // Set a flag to auto-start on first move
        hasMovedRef.current = false; // Will be set to true once threshold is crossed
      }
    }
  }, [readOnly, isDragEnabled, rankFileToSquare, boardState, currentPlayerColor, enablePremove, isPlayerTurn, userPrefersDrag]);

  // Track mouse movement during drag for ghost piece
  // Use requestAnimationFrame to avoid excessive re-renders
  // Declared early to be used by handleDragEnd
  const ghostPieceRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDragOverSquareRef = useRef<Square | null>(null);
  const draggedPieceRef = useRef<{ square: Square; piece: Piece; originTarget?: EventTarget | null } | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null); // Track drag start position to distinguish click from drag
  const hasMovedRef = useRef<boolean>(false); // Track if mouse moved during drag
  const keyHasChangedRef = useRef<boolean>(false); // Track if drag has left the original square

  // Handle drag over (now inlined in onDragOver for better control)
  // Keeping this for potential future use, but primary handler is inline
  const handleDragOver = useCallback((e: React.DragEvent, rank: number, file: number) => {
    // This is now handled inline in the onDragOver handler
    // Keeping for backwards compatibility if needed
  }, []);

  // Handle drag end - defined early to be used by handleDrop
  // Must clear ALL drag-related state to prevent ghost piece from sticking
  const handleDragEnd = useCallback((e?: React.DragEvent) => {
    // If a drop was successfully handled, don't clear state again (already cleared in handleDrop)
    if (dropHandledRef.current) {
      dropHandledRef.current = false;
    }
    
    // Always clear everything, regardless of where drag ended
    setDraggedPiece(null);
    draggedPieceRef.current = null;
    setDragOverSquare(null);
    // CRITICAL: Clear ghost piece immediately and synchronously
    setGhostPiecePosition(null);
    ghostPieceRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastDragOverSquareRef.current = null;
    dragStartPosRef.current = null;
    hasMovedRef.current = false;
    
    // If drag ended without a valid drop, clear selection
    if (externalSelectedSquare === undefined) {
      setInternalSelectedSquare(null);
    }
  }, [externalSelectedSquare]);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, rank: number, file: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // CRITICAL: Stop the default drag behavior
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    
    // Use ref to get dragged piece (might be cleared by dragend, but ref persists)
    const currentDraggedPiece = draggedPieceRef.current || draggedPiece;
    
    if (!currentDraggedPiece) {
      handleDragEnd();
      return;
    }
    
    const targetSquare = rankFileToSquare(rank, file);
    
    // Check for pawn promotion
    const targetPiece = boardState[rank]?.[file];
    const sourcePiece = chess.get(currentDraggedPiece.square as any);
    if (!sourcePiece) {
      // No piece to move - clear drag state
      handleDragEnd();
      return;
    }
    
    const isPawn = sourcePiece.type === 'p';
    const targetRank = targetSquare[1];
    const isPromotion = isPawn && (
      (sourcePiece.color === 'w' && targetRank === '8') ||
      (sourcePiece.color === 'b' && targetRank === '1')
    );

    // ALWAYS validate move using chess.js before allowing it (like click-to-move)
    // This is CRITICAL - validate before any optimistic updates
    let validMove: any = null;
    let promotionPiece: PieceType | undefined = isPromotion ? 'q' : undefined;
    
    // Extra validation: Check if king is trying to move 2 squares (must be castling)
    if (sourcePiece.type === 'k') {
      const fileDiff = Math.abs(targetSquare.charCodeAt(0) - currentDraggedPiece.square.charCodeAt(0));
      if (fileDiff === 2) {
        // King moving 2 squares - must be castling, chess.js will validate if it's legal
        // Don't reject here, let chess.js handle it
      } else if (fileDiff > 2) {
        // King trying to move more than 2 squares (not 1, not 2) - definitely illegal
        handleDragEnd();
        return;
      } else if (fileDiff === 0) {
        // King trying to stay in place - illegal
        handleDragEnd();
        return;
      }
    }
    
    try {
      // Create a fresh chess instance for validation
      const testChess = new Chess(chess.fen());
      
      // Validate the move - chess.js will throw or return null if illegal
      validMove = testChess.move({ 
        from: currentDraggedPiece.square as any, 
        to: targetSquare,
        promotion: promotionPiece
      });
      
      if (!validMove) {
        // Move is invalid according to chess.js
        if (enablePremove && !isPlayerTurn) {
          // Allow as premove (will be validated later)
          if (onMove) {
            setPremoves(prev => [...prev, { from: currentDraggedPiece.square, to: targetSquare }]);
          }
          handleDragEnd();
          return;
        } else {
          // Invalid move - reject immediately
          handleDragEnd();
          return;
        }
      }
    } catch (error) {
      // chess.js threw an error - move is definitely illegal
      if (enablePremove && !isPlayerTurn) {
        // Allow as premove
        if (onMove) {
          setPremoves(prev => [...prev, { from: currentDraggedPiece.square, to: targetSquare }]);
        }
        handleDragEnd();
        return;
      } else {
        // Invalid move - reject
        handleDragEnd();
        return;
      }
    }

    // Move is valid - handle promotion dialog if needed
    if (isPromotion && onPromotionSelect) {
      setPendingPromotion({ from: currentDraggedPiece.square, to: targetSquare });
      setShowPromotionDialog(true);
      handleDragEnd();
      return;
    }

    // Update promotion piece from the actual move
    if (validMove && validMove.promotion) {
      promotionPiece = validMove.promotion as PieceType;
    }

    // Make the move - only if it's our turn (not a premove)
    if (onMove && isPlayerTurn) {
      // Determine move type for sound
      let isCastle = false;
      if (sourcePiece.type === 'k') {
        const fileDiff = Math.abs(targetSquare.charCodeAt(0) - currentDraggedPiece.square.charCodeAt(0));
        if (fileDiff === 2) {
          isCastle = true;
        }
      }
      
      const isCapture = !!validMove.captured;
      const isCheck = validMove.san.includes('+') || validMove.san.includes('#');
      
      // Play appropriate sound
      if (isCastle) {
        playSound('castle');
      } else if (isPromotion) {
        playSound('promotion');
      } else if (isCheck) {
        playSound('check');
      } else if (isCapture) {
        playSound('capture');
      } else {
        playSound('move');
      }
      
      // Optimistically make the move in internal chess instance for immediate visual update
      // We already validated with testChess, so this should succeed
      try {
        // Store the FEN BEFORE making the optimistic move - we'll use this to detect reverts
        const fenBeforeMove = chess.fen();
        const normalizedFenBeforeMove = normalizeFen(fenBeforeMove);
        preOptimisticFenRef.current = fenBeforeMove;
        
        
        const optimisticMove = chess.move({ 
          from: currentDraggedPiece.square as any, 
          to: targetSquare,
          promotion: promotionPiece
        });
        
        if (!optimisticMove) {
          // This shouldn't happen since we validated, but handle it
          console.error('[Chess960Board] Optimistic move failed after validation');
          handleDragEnd();
          return;
        }
        
        // Get the new FEN from our chess instance
        const newFen = chess.fen();
        const normalizedNewFen = normalizeFen(newFen);
        
        // Parse the new board state
        const newBoardState = parseFen(newFen);
        
        // Update board state IMMEDIATELY and synchronously
        // We need to update both boardState and the refs at the same time
        const currentBoardState = boardStateRef.current;
        const prevStateCopy = currentBoardState.length > 0 
          ? (currentBoardState.map(rank => rank.map(piece => piece ? { ...piece } : null)) as Piece[][])
          : newBoardState;
        
        // Update refs FIRST (synchronous)
        boardStateRef.current = newBoardState;
        previousBoardStateRef.current = prevStateCopy;
        lastFenRef.current = newFen;
        
        // Mark optimistic update BEFORE any async operations
        optimisticUpdateRef.current = true;
        dropHandledRef.current = true;
        
        // CRITICAL: Clear ghost piece IMMEDIATELY and synchronously before any state updates
        // This ensures it disappears right away and doesn't stick to cursor
        setGhostPiecePosition(null);
        ghostPieceRef.current = null;
        
        // Then update React state (async, but refs are already set)
        setPreviousBoardState(prevStateCopy);
        setBoardState(newBoardState);
        
        // Clear drag state IMMEDIATELY - this ensures ghost piece disappears right away
        handleDragEnd();
        if (externalSelectedSquare === undefined) {
          setInternalSelectedSquare(null);
        }
        
        // Call parent's onMove callback AFTER everything is set
        // The parent will process the move and send back the new FEN
        // Our optimistic update protection will prevent reverting if parent sends old FEN
        onMove(currentDraggedPiece.square, targetSquare, promotionPiece);
      } catch (error) {
        // This shouldn't happen since we validated, but handle it
        console.error('[Chess960Board] Optimistic move error after validation:', error);
        handleDragEnd();
        return;
      }
    } else {
      // Not our turn but move is valid - must be a premove (handled above)
      // This shouldn't happen, but handle it gracefully
      handleDragEnd();
      return;
    }
  }, [draggedPiece, rankFileToSquare, boardState, chess, enablePremove, isPlayerTurn, onMove, onPromotionSelect, externalSelectedSquare, playSound, handleDragEnd]);

  // Always attach mouse listeners - they check refs internally
  // This ensures drag works even before draggedPiece state is set
  useEffect(() => {

    const handleMouseMove = (e: MouseEvent) => {
      // Use ref to check if we have a potential drag (avoids stale closure)
      if (!boardRef.current || !draggedPieceRef.current || !dragStartPosRef.current) {
        return;
      }
      
      // Check if mouse has moved enough to be considered a drag (not a click)
      const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
      const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
      const dragThreshold = 3; // pixels - lower threshold for better responsiveness
      
      if (dx > dragThreshold || dy > dragThreshold) {
        // Mouse moved - this is a drag, not a click
        if (!hasMovedRef.current) {
          // First time moving - now set draggedPiece state and start drag
          hasMovedRef.current = true;
          if (draggedPieceRef.current) {
            setDraggedPiece(draggedPieceRef.current);
          }
        }
        
        // Prevent default only when actually dragging
        e.preventDefault();
      } else {
        // Mouse hasn't moved enough - this is still a potential click
        // Don't set hasMovedRef yet - wait for mouseup to confirm
        // This allows onClick to fire for clicks
      }
      
      // Only update ghost piece if we're actually dragging (mouse moved)
      if (hasMovedRef.current && draggedPieceRef.current) {
        const boardRect = boardRef.current.getBoundingClientRect();
        // Constrain ghost piece to board bounds
        const x = Math.max(0, Math.min(
          e.clientX - boardRect.left - squareSize / 2,
          boardRect.width - squareSize
        ));
        const y = Math.max(0, Math.min(
          e.clientY - boardRect.top - squareSize / 2,
          boardRect.height - squareSize
        ));
        
        // Update ref immediately for smooth tracking
        ghostPieceRef.current = { x, y };
        
        // Throttle state updates using requestAnimationFrame
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            // Check ref again in callback (closure may be stale)
            if (ghostPieceRef.current && draggedPieceRef.current) {
              // Use functional update to avoid dependency on current state
              setGhostPiecePosition(ghostPieceRef.current);
            }
            rafRef.current = null;
          });
        }
      }
    };

    // Also handle touch move for mobile
    const handleTouchMove = (e: TouchEvent) => {
      if (boardRef.current && draggedPieceRef.current && e.touches.length > 0) {
        const boardRect = boardRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        const x = Math.max(0, Math.min(
          touch.clientX - boardRect.left - squareSize / 2,
          boardRect.width - squareSize
        ));
        const y = Math.max(0, Math.min(
          touch.clientY - boardRect.top - squareSize / 2,
          boardRect.height - squareSize
        ));
        
        ghostPieceRef.current = { x, y };
        
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            // Only update if still dragging
            if (ghostPieceRef.current) {
              setGhostPiecePosition((current) => {
                return ghostPieceRef.current || current;
              });
            }
            rafRef.current = null;
          });
        }
      }
    };

    // Handle mouse up - complete drag and drop
    const handleGlobalMouseUp = (e: MouseEvent | TouchEvent) => {
      if (!boardRef.current) {
        // Reset drag tracking even if no drag was active
        dragStartPosRef.current = null;
        hasMovedRef.current = false;
        draggedPieceRef.current = null;
        return;
      }

      // Get mouse/touch position
      let clientX: number;
      let clientY: number;
      if (e instanceof MouseEvent) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        if (e.changedTouches.length === 0) {
          dragStartPosRef.current = null;
          hasMovedRef.current = false;
          draggedPieceRef.current = null;
          if (draggedPiece) {
            handleDragEnd();
          }
          return;
        }
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      }

      // Check if this was a click (mouse didn't move) or a drag (mouse moved)
      const hadMoved = hasMovedRef.current;
      const hadDragStart = dragStartPosRef.current !== null;
      const hadDraggedPieceState = draggedPiece !== null;
      
      // If mouse didn't move enough, this was a click, not a drag
      // Clear all drag tracking refs immediately so onClick handlers can process it
      if (draggedPieceRef.current && !hasMovedRef.current) {
        // Check threshold to confirm it's a click
        if (dragStartPosRef.current) {
          const dx = Math.abs(clientX - dragStartPosRef.current.x);
          const dy = Math.abs(clientY - dragStartPosRef.current.y);
          const clickThreshold = 3; // pixels - match dragThreshold
          
          if (dx < clickThreshold && dy < clickThreshold) {
            // This was definitely a click - clear refs immediately
            // onClick handlers will process the click
            dragStartPosRef.current = null;
            hasMovedRef.current = false;
            draggedPieceRef.current = null;
            return;
          }
        } else {
          // No drag start position but ref is set - clear it
          dragStartPosRef.current = null;
          hasMovedRef.current = false;
          draggedPieceRef.current = null;
          return;
        }
      }
      
      // Also handle case where we had drag start but no movement and no draggedPiece state
      if (hadDragStart && !hadMoved && !hadDraggedPieceState) {
        // This was a click - clear refs
        dragStartPosRef.current = null;
        hasMovedRef.current = false;
        draggedPieceRef.current = null;
        return;
      }

      // This was a drag - check if we have a dragged piece
      if (!draggedPieceRef.current) {
        dragStartPosRef.current = null;
        hasMovedRef.current = false;
        return;
      }

      const currentDraggedPiece = draggedPieceRef.current;

      // This was a drag - process the drop
      // Calculate which square the mouse is over
      const boardRect = boardRef.current.getBoundingClientRect();
      const relativeX = clientX - boardRect.left;
      const relativeY = clientY - boardRect.top;

      // Check if mouse is within board bounds
      if (relativeX >= 0 && relativeX < boardRect.width && relativeY >= 0 && relativeY < boardRect.height) {
        // Calculate which square
        const file = Math.floor(relativeX / squareSize);
        const displayRank = Math.floor(relativeY / squareSize);
        
        // Convert display coordinates to actual board coordinates
        const actualRank = orientation === 'white' ? displayRank : 7 - displayRank;
        const actualFile = orientation === 'white' ? file : 7 - file;
        
        // Clamp to valid range
        if (actualRank >= 0 && actualRank < 8 && actualFile >= 0 && actualFile < 8) {
          const targetSquare = rankFileToSquare(actualRank, actualFile);
          
          // Process the drop
          processDrop(currentDraggedPiece.square, targetSquare);
        } else {
          // Mouse released outside board - cancel drag
          handleDragEnd();
        }
      } else {
        // Mouse released outside board - cancel drag
        handleDragEnd();
      }
      
      // Always clear drag tracking after mouseup
      dragStartPosRef.current = null;
      hasMovedRef.current = false;
    };

    // Process drop - extract from handleDrop logic
    // We need to access variables from the component scope
    // Since this is inside useEffect, we need to be careful about dependencies
    const processDrop = (fromSquare: Square, targetSquare: Square) => {
      // We'll use the existing handleDrop logic
      // Calculate rank/file from targetSquare to match handleDrop signature
      const targetRankNum = '87654321'.indexOf(targetSquare[1]);
      const targetFileNum = 'abcdefgh'.indexOf(targetSquare[0]);
      
      // Create a minimal synthetic event just to match handleDrop signature
      // handleDrop expects (e: React.DragEvent, rank: number, file: number)
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        dataTransfer: null,
      } as unknown as React.DragEvent;
      
      // Call handleDrop with the synthetic event
      handleDrop(syntheticEvent, targetRankNum, targetFileNum);
    };

    // Always attach listeners - they check refs internally to see if drag is active
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Only clear ghost piece on unmount, not on every cleanup
      // Otherwise it will clear during drag operations
    };
  }, [squareSize, orientation, rankFileToSquare, chess, boardState, enablePremove, isPlayerTurn, onMove, onPromotionSelect, externalSelectedSquare, handleDragEnd, handleDrop, handleSquareClick]); // Removed draggedPiece from deps - listeners check refs instead
  
  // Keep ref in sync with state
  useEffect(() => {
    draggedPieceRef.current = draggedPiece || draggedPieceRef.current;
    
    // Clean up when drag ends (draggedPiece becomes null)
    if (!draggedPiece) {
      setGhostPiecePosition(null);
      ghostPieceRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [draggedPiece]);

  // Calculate valid moves for arrow start square (for snapping)
  const arrowValidMoves = useMemo(() => {
    if (!arrowStart || !snapToValidMoves || readOnly) return new Set<Square>();
    try {
      const moves = chess.moves({ square: arrowStart as any, verbose: true });
      return new Set(moves.map((move: any) => move.to));
    } catch {
      return new Set<Square>();
    }
  }, [arrowStart, snapToValidMoves, chess, readOnly]);

  // Handle right click - for square highlighting, arrow start, and destination display
  // Right-click is handled in mousedown, not contextmenu, to prevent move calculation
  // It immediately cancels any drag/draw and clears selection
  const handleRightClick = useCallback((e: React.MouseEvent, rank: number, file: number) => {
    // Prevent context menu
    e.preventDefault();
    e.stopPropagation();
    
    if (readOnly) return;

    // CRITICAL: Clear selection IMMEDIATELY FIRST to prevent any premove calculation
    // This must be the very first thing we do
    if (externalSelectedSquare === undefined) {
      setInternalSelectedSquare(null);
    }
    
    // Cancel premoves immediately
    if (premoves.length > 0) {
      setPremoves([]);
    }
    
    // Clear right-click hover
    setRightClickHoverSquare(null);

    // Cancel any ongoing drag
    if (draggedPiece) {
      handleDragEnd();
    }
    
    // Cancel any ongoing arrow drawing
    if (isDrawingArrow) {
      setIsDrawingArrow(false);
      setArrowStart(null);
      setDragOverSquare(null);
    }

    const square = rankFileToSquare(rank, file);
    const piece = boardState[rank]?.[file];
    
    // If right-clicking on a piece, show destinations
    if (piece && showDestinations) {
      setRightClickHoverSquare(square);
    }

    // Handle arrow drawing or square highlighting
    if (onArrowsChange) {
      // Start arrow drawing
      if (!arrowStart) {
        setArrowStart(square);
        setIsDrawingArrow(true);
        // Initialize dragOverSquare to the start square for immediate feedback
        setDragOverSquare(square);
      } else {
        // Complete arrow - use snapped square if available
        const endSquare = snapToValidMoves && dragOverSquare && arrowValidMoves.has(dragOverSquare)
          ? dragOverSquare
          : square;
        
        if (arrowStart !== endSquare) {
          const newArrow = {
            startSquare: arrowStart,
            endSquare: endSquare,
            color: 'rgba(255, 170, 0, 0.5)',
          };
          const updatedArrows = [...arrows, newArrow];
          onArrowsChange(updatedArrows);
        }
        setArrowStart(null);
        setIsDrawingArrow(false);
        setDragOverSquare(null);
      }
    } else {
      // Simple square highlighting - toggle on/off
      setRightClickedSquares(prev => {
        const color = 'rgba(0, 0, 255, 0.4)';
        const isHighlighted = prev[square]?.backgroundColor === color;
        if (isHighlighted) {
          // Remove highlight
          const { [square]: _, ...rest } = prev;
          return rest;
        }
        // Add highlight
        return { ...prev, [square]: { backgroundColor: color } };
      });
    }
  }, [readOnly, rankFileToSquare, premoves, boardState, onArrowsChange, arrowStart, arrows, snapToValidMoves, dragOverSquare, arrowValidMoves, showDestinations, externalSelectedSquare, draggedPiece, isDrawingArrow, handleDragEnd]);
  
  // Context menu handler - just prevent default
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Handle mouse enter for arrow drawing with snapping
  const handleMouseEnter = useCallback((rank: number, file: number) => {
    if (isDrawingArrow && arrowStart) {
      const square = rankFileToSquare(rank, file);
      
      // If snapping is enabled and this square is a valid move, snap to it
      if (snapToValidMoves && arrowValidMoves.has(square)) {
        setDragOverSquare(square);
      } else if (!snapToValidMoves) {
        // Without snapping, follow mouse normally
        setDragOverSquare(square);
      }
    }
  }, [isDrawingArrow, arrowStart, rankFileToSquare, snapToValidMoves, arrowValidMoves]);

  // Helper to find nearest valid square for snapping
  const findNearestValidSquare = useCallback((targetSquare: Square, validMoves: Set<Square>): Square | null => {
    if (validMoves.size === 0) return null;
    
    const targetCoords = squareToRankFile(targetSquare);
    let nearest: Square | null = null;
    let minDistance = Infinity;
    
    for (const validSquare of validMoves) {
      const validCoords = squareToRankFile(validSquare);
      const distance = Math.sqrt(
        Math.pow(validCoords.rank - targetCoords.rank, 2) + 
        Math.pow(validCoords.file - targetCoords.file, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = validSquare;
      }
    }
    
    // Only snap if within reasonable distance (2 squares)
    return minDistance <= 2 ? nearest : null;
  }, [squareToRankFile]);

  // Handle mouse move for arrow drawing with snapping (for better mouse tracking)
  // Use ref to track last square to avoid excessive updates
  // (lastDragOverSquareRef already declared above)
  const handleMouseMove = useCallback((e: React.MouseEvent, rank: number, file: number) => {
    if (isDrawingArrow && arrowStart && snapToValidMoves) {
      const square = rankFileToSquare(rank, file);
      
      let targetSquare: Square | null = null;
      
      // If this square is a valid move, snap to it
      if (arrowValidMoves.has(square)) {
        targetSquare = square;
      } else {
        // Find nearest valid move square
        const nearestValid = findNearestValidSquare(square, arrowValidMoves);
        if (nearestValid) {
          targetSquare = nearestValid;
        }
      }
      
      // Only update if changed to avoid infinite loops
      if (targetSquare && targetSquare !== lastDragOverSquareRef.current) {
        lastDragOverSquareRef.current = targetSquare;
        setDragOverSquare(targetSquare);
      }
    }
  }, [isDrawingArrow, arrowStart, snapToValidMoves, arrowValidMoves, rankFileToSquare, findNearestValidSquare]);

  // Touch ignore radius helper
  const shouldIgnoreTouch = useCallback((e: React.TouchEvent, rank: number, file: number): boolean => {
    if (touchIgnoreRadius === 0) return false;
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Calculate distance from square center
    const centerX = squareSize / 2;
    const centerY = squareSize / 2;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    const ignoreRadiusPx = touchIgnoreRadius * squareSize;
    
    return distance > ignoreRadiusPx;
  }, [touchIgnoreRadius, squareSize]);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent, rank: number, file: number) => {
    if (readOnly || !onMove) return;
    if (shouldIgnoreTouch(e, rank, file)) return;
    
    e.preventDefault();
    handleSquareClick(rank, file, e);
  }, [readOnly, onMove, shouldIgnoreTouch, handleSquareClick]);

  // Keyboard move input handler
  const parseKeyboardMove = useCallback((input: string): { from: Square; to: Square } | null => {
    input = input.trim().toLowerCase();
    
    // UCI format: e2e4
    if (/^[a-h][1-8][a-h][1-8]$/.test(input)) {
      return {
        from: input.substring(0, 2) as Square,
        to: input.substring(2, 4) as Square,
      };
    }
    
    // SAN format: Nf3, e4, O-O, etc. (simplified)
    try {
      // Castling
      if (input === 'o-o' || input === '0-0') {
        const turn = chess.turn();
        const rank = turn === 'w' ? 7 : 0;
        const kingSquare = rankFileToSquare(rank, 4); // e-file
        const rookSquare = rankFileToSquare(rank, 7); // h-file
        return { from: kingSquare, to: rookSquare };
      }
      if (input === 'o-o-o' || input === '0-0-0') {
        const turn = chess.turn();
        const rank = turn === 'w' ? 7 : 0;
        const kingSquare = rankFileToSquare(rank, 4); // e-file
        const rookSquare = rankFileToSquare(rank, 0); // a-file
        return { from: kingSquare, to: rookSquare };
      }
      
      // Try to parse as SAN using chess.js
      const moves = chess.moves({ verbose: true });
      const move = moves.find((m: any) => m.san.toLowerCase() === input);
      if (move) {
        return { from: move.from as Square, to: move.to as Square };
      }
    } catch (error) {
      // Failed to parse
    }
    
    return null;
  }, [chess, rankFileToSquare]);

  // Keyboard event handler
  useEffect(() => {
    if (!enableKeyboard || readOnly) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture input if typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // Handle special keys
      if (e.key === 'Escape') {
        keyboardInputRef.current = '';
        setKeyboardInput('');
        if (externalSelectedSquare === undefined) {
          setInternalSelectedSquare(null);
        }
        return;
      }
      
      if (e.key === 'Backspace') {
        keyboardInputRef.current = keyboardInputRef.current.slice(0, -1);
        setKeyboardInput(keyboardInputRef.current);
        return;
      }
      
      if (e.key === 'Enter') {
        const move = parseKeyboardMove(keyboardInputRef.current);
        if (move && onMove) {
          onMove(move.from, move.to);
          keyboardInputRef.current = '';
          setKeyboardInput('');
        }
        return;
      }
      
      // Handle alphanumeric input
      if (/^[a-h0-8o-]$/i.test(e.key)) {
        keyboardInputRef.current += e.key.toLowerCase();
        setKeyboardInput(keyboardInputRef.current);
        
        // Auto-submit if input matches UCI format
        if (keyboardInputRef.current.length === 4 && /^[a-h][1-8][a-h][1-8]$/.test(keyboardInputRef.current)) {
          const move = parseKeyboardMove(keyboardInputRef.current);
          if (move && onMove) {
            onMove(move.from, move.to);
            keyboardInputRef.current = '';
            setKeyboardInput('');
          }
        }
        
        // Call custom keyboard input handler if provided
        if (onKeyboardInput) {
          onKeyboardInput(keyboardInputRef.current);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, readOnly, onMove, parseKeyboardMove, onKeyboardInput, externalSelectedSquare]);

  // Clear arrow drawing on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArrowStart(null);
        setIsDrawingArrow(false);
        setRightClickedSquares({});
        if (onArrowsChange) {
          onArrowsChange([]);
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onArrowsChange]);

  // Resize handle handlers
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: internalWidth,
    };
  }, [internalWidth]);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    // Use diagonal distance for resizing
    const distance = (deltaX - deltaY) / 2;
    
    // Calculate new width (1 pixel = 0.5px board width)
    const widthDelta = distance * 0.5;
    const minWidth = 200;
    const maxWidth = 800;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartRef.current.width + widthDelta));
    
    setInternalWidth(newWidth);
    if (onResize) {
      onResize(newWidth);
    }
  }, [isResizing, onResize]);

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
    resizeStartRef.current = null;
  }, []);

  // Set up global mouse event listeners during resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  // Helper to draw arrow SVG between two squares
  const getArrowPath = useCallback((start: Square, end: Square): string | null => {
    const startCoords = squareToRankFile(start);
    const endCoords = squareToRankFile(end);
    
    // Convert to display coordinates
    const startDisplayRank = orientation === 'white' ? startCoords.rank : 7 - startCoords.rank;
    const startDisplayFile = orientation === 'white' ? startCoords.file : 7 - startCoords.file;
    const endDisplayRank = orientation === 'white' ? endCoords.rank : 7 - endCoords.rank;
    const endDisplayFile = orientation === 'white' ? endCoords.file : 7 - endCoords.file;
    
    const startX = startDisplayFile * squareSize + squareSize / 2;
    const startY = startDisplayRank * squareSize + squareSize / 2;
    const endX = endDisplayFile * squareSize + squareSize / 2;
    const endY = endDisplayRank * squareSize + squareSize / 2;
    
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    const arrowLength = Math.sqrt(dx * dx + dy * dy);
    const arrowHeadSize = squareSize * 0.15;
    
    // Arrow shaft
    const shaftEndX = endX - Math.cos(angle) * arrowHeadSize;
    const shaftEndY = endY - Math.sin(angle) * arrowHeadSize;
    
    // Arrow head
    const arrowHeadAngle = Math.PI / 6;
    const headX1 = endX - Math.cos(angle - arrowHeadAngle) * arrowHeadSize;
    const headY1 = endY - Math.sin(angle - arrowHeadAngle) * arrowHeadSize;
    const headX2 = endX - Math.cos(angle + arrowHeadAngle) * arrowHeadSize;
    const headY2 = endY - Math.sin(angle + arrowHeadAngle) * arrowHeadSize;
    
    return `M ${startX} ${startY} L ${shaftEndX} ${shaftEndY} M ${endX} ${endY} L ${headX1} ${headY1} M ${endX} ${endY} L ${headX2} ${headY2}`;
  }, [orientation, squareSize, squareToRankFile]);

  return (
    <div 
      ref={boardRef}
      className="relative inline-block"
      style={{ 
        width: `${internalWidth}px`, 
        height: `${internalWidth}px`,
        position: 'relative',
      }}
      onContextMenu={(e) => {
        // Prevent context menu on the entire board
        e.preventDefault();
      }}
    >
      {/* Board squares */}
      <div 
        className="relative w-full h-full"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        {/* Render display positions (screen coordinates) */}
        {Array.from({ length: 8 }, (_, displayRank) =>
          Array.from({ length: 8 }, (_, displayFile) => {
            // Convert display coordinates to actual board coordinates
            // boardState[0] = rank 8 (black), boardState[7] = rank 1 (white)
            // For white orientation: displayRank 0 (top) = boardState[0] (rank 8/black)
            //                      displayRank 7 (bottom) = boardState[7] (rank 1/white)
            const actualRank = orientation === 'white' 
              ? displayRank  // displayRank 0->7 maps to boardState 0->7 (rank 8->1)
              : 7 - displayRank; // flipped for black orientation
            
            const actualFile = orientation === 'white'
              ? displayFile
              : 7 - displayFile;
            
            const squareColor = getSquareColor(actualRank, actualFile);
            const piece = boardState[actualRank]?.[actualFile];
            const square = rankFileToSquare(actualRank, actualFile);
            const isSelected = selectedSquare === square;
            const isRightClickHover = rightClickHoverSquare === square;
            const isLastMoveFrom = lastMove && lastMove[0] === square;
            const isLastMoveTo = lastMove && lastMove[1] === square;
            const isLegalMove = effectiveLegalMoves.includes(square);
            const isInCheckSquare = checkSquare === square;
            const isDragOver = dragOverSquare === square;
            const isRightClicked = rightClickedSquares[square];
            const isDragged = draggedPiece?.square === square; // Piece being dragged is temporarily hidden
            
            // Determine square background color with priority
            let squareBgColor = squareColor === 'dark' ? theme.dark : theme.light;
            if (isRightClicked) {
              squareBgColor = isRightClicked.backgroundColor;
            } else if (isDragOver) {
              squareBgColor = 'rgba(255, 255, 0, 0.6)'; // Bright yellow for drag over
            } else if (isLastMoveFrom || isLastMoveTo) {
              squareBgColor = 'rgba(255, 255, 0, 0.4)'; // Yellow for last move
            } else if (isSelected || isRightClickHover) {
              squareBgColor = 'rgba(255, 165, 0, 0.5)'; // Orange for selected or right-click hover
            } else if (showDestinations && isLegalMove) {
              // Highlight destination squares more subtly when showing destinations
              // The dot/ring indicators provide the main visual feedback
              squareBgColor = piece 
                ? squareBgColor // Keep original color for captures, ring provides the indicator
                : squareBgColor; // Keep original color for moves, dot provides the indicator
            }

            return (
              <div
                key={`${displayRank}-${displayFile}`}
                data-square={square}
                className="absolute transition-colors duration-150"
                style={{
                  left: `${displayFile * squareSize}px`,
                  top: `${displayRank * squareSize}px`,
                  width: `${squareSize}px`,
                  height: `${squareSize}px`,
                  backgroundColor: squareBgColor,
                  border: isSelected ? '2px solid #f59e0b' : isInCheckSquare ? '3px solid #ff0000' : 'none',
                  cursor: readOnly 
                    ? 'default' 
                    : piece 
                      ? (isClickEnabled ? 'pointer' : (isDragEnabled ? 'grab' : 'default'))
                      : (isClickEnabled && isLegalMove ? 'pointer' : 'default'),
                  position: 'absolute',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onClick={(e) => {
                  // Don't handle right-clicks here - they're handled in onMouseDown
                  if ((e as React.MouseEvent).button === 2) {
                    return;
                  }
                  
                  // If click came from a piece (event target is the piece div or its children),
                  // let the piece's onClick handle it instead
                  const target = e.target as HTMLElement;
                  if (target.closest('.piece-container') || target.closest('[data-piece-click]')) {
                    // Let piece's onClick handle it
                    return;
                  }
                  
                  // Handle click on empty square or if piece click didn't handle it
                  // CRITICAL: Only block if mouse actually moved (it was a drag, not a click)
                  // If hasMovedRef is false, it means mouse didn't move enough - it's a click, allow it
                  const wasDrag = hasMovedRef.current && draggedPieceRef.current !== null;
                  
                  // If it was a drag, don't handle click (drag was already handled in mouseup)
                  if (wasDrag) {
                    // Clear drag refs since drag is complete
                    draggedPieceRef.current = null;
                    dragStartPosRef.current = null;
                    hasMovedRef.current = false;
                    return;
                  }
                  
                  // This was a click (not a drag) - clear any drag tracking refs
                  // and process the click normally
                  draggedPieceRef.current = null;
                  dragStartPosRef.current = null;
                  hasMovedRef.current = false;
                  
                  // Clear right-click hover on left click
                  setRightClickHoverSquare(null);
                  
                  // Handle the click - this works for both pieces and empty squares
                  handleSquareClick(actualRank, actualFile, e);
                }}
                onMouseDown={(e) => {
                  // Handle right-click in mousedown
                  // This must happen BEFORE any other handlers to prevent move calculation
                  if (e.button === 2 || e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRightClick(e, actualRank, actualFile);
                    return;
                  }
                  // For left clicks, don't prevent default - allow dragging
                }}
                onTouchStart={(e) => handleTouchStart(e, actualRank, actualFile)}
                onContextMenu={handleContextMenu}
                onMouseEnter={(e) => {
                  // Update drag over square during drag (for visual feedback)
                  if (draggedPiece) {
                    const square = rankFileToSquare(actualRank, actualFile);
                    setDragOverSquare(square);
                  }
                  handleMouseEnter(actualRank, actualFile);
                  if (isDrawingArrow) {
                    handleMouseMove(e, actualRank, actualFile);
                  }
                  // Show destinations on right-click drag/hover
                  if (e.buttons === 2 && !readOnly && showDestinations) {
                    const square = rankFileToSquare(actualRank, actualFile);
                    const piece = boardState[actualRank]?.[actualFile];
                    if (piece) {
                      setRightClickHoverSquare(square);
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  // Clear right-click hover when mouse leaves (but only if not right-dragging)
                  if (e.buttons !== 2) {
                    setRightClickHoverSquare(null);
                  }
                }}
                onMouseMove={(e) => {
                  // Update drag over square during drag (for visual feedback)
                  if (draggedPiece) {
                    const square = rankFileToSquare(actualRank, actualFile);
                    setDragOverSquare(square);
                  }
                  if (isDrawingArrow) {
                    handleMouseMove(e, actualRank, actualFile);
                  }
                }}
              >
                {/* Legal move indicator (dot for empty squares) - subtle */}
                {showDestinations && isLegalMove && !piece && !isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div 
                      className="rounded-full transition-opacity duration-150"
                      style={{
                        width: squareSize * 0.25,
                        height: squareSize * 0.25,
                        backgroundColor: 'rgba(0, 0, 0, 0.15)',
                        boxShadow: '0 0 2px rgba(0, 0, 0, 0.3)',
                      }}
                    />
                  </div>
                )}
                
                {/* Capture indicator (ring around piece for captures) - subtle */}
                {showDestinations && isLegalMove && piece && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      border: '2px solid rgba(0, 0, 0, 0.25)',
                      borderRadius: '50%',
                      boxShadow: 'inset 0 0 4px rgba(0, 0, 0, 0.2), 0 0 4px rgba(0, 0, 0, 0.2)',
                    }}
                  />
                )}

                {/* Piece - hide if it's being animated from another square or in blindfold mode */}
                {piece && !blindfold && (() => {
                  const pieceKey = `${square}-${piece.color}-${piece.type}`;
                  const isAnimating = animatingPieces.has(pieceKey);
                  const isBeingDragged = draggedPiece?.square === square;
                  
                  // Don't show piece if it's currently animating from another square
                  if (isAnimating) {
                    return null;
                  }
                  
                  // Hide piece completely when being dragged (we show ghost piece instead)
                  if (isBeingDragged) {
                    return null;
                  }
                  
                  const pieceDraggable = !readOnly && isDragEnabled;
                  
                  return (
                    <div
                      className="w-full h-full flex items-center justify-center piece-container"
                      data-piece-click="true"
                      onMouseDown={(e) => {
                        // Only set up drag tracking if drag is enabled
                        // If only click is enabled, don't interfere with click handling
                        if (pieceDraggable && e.button === 0) {
                          handlePieceMouseDown(e, actualRank, actualFile);
                          // Don't prevent default - allow click event to fire
                        } else if (e.button === 2) {
                          e.preventDefault(); // Prevent context menu on right click
                        }
                        // Don't prevent default or stop propagation - let clicks work normally
                        // The onClick handler will determine if it was a click or drag
                      }}
                      onClick={(e) => {
                        // Handle clicks on pieces when click mode is enabled
                        // Allow clicks even if onMove is undefined (for piece selection)
                        if (readOnly || !isClickEnabled) {
                          return;
                        }
                        if ((e as React.MouseEvent).button === 2) {
                          return;
                        }
                        
                        // CRITICAL: If mouse didn't move, it's definitely a click
                        // hasMovedRef is only set to true when mouse actually moves during drag
                        if (hasMovedRef.current) {
                          // Mouse moved - this was a drag, not a click
                          draggedPieceRef.current = null;
                          dragStartPosRef.current = null;
                          hasMovedRef.current = false;
                          return;
                        }
                        
                        // Verify by checking distance if we have drag start position
                        if (dragStartPosRef.current) {
                          const currentX = (e as React.MouseEvent).clientX;
                          const currentY = (e as React.MouseEvent).clientY;
                          const dx = Math.abs(currentX - dragStartPosRef.current.x);
                          const dy = Math.abs(currentY - dragStartPosRef.current.y);
                          const clickThreshold = 5;
                          
                          if (dx >= clickThreshold || dy >= clickThreshold) {
                            // Mouse moved too much - this was a drag
                            draggedPieceRef.current = null;
                            dragStartPosRef.current = null;
                            hasMovedRef.current = false;
                            return;
                          }
                        }
                        
                        // This was definitely a click (not a drag) - process it immediately
                        // Clear any drag tracking refs that might have been set
                        draggedPieceRef.current = null;
                        dragStartPosRef.current = null;
                        hasMovedRef.current = false;
                        
                        // CRITICAL: Stop propagation to prevent square's onClick from also firing
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Handle the click directly - this selects the piece or makes a move
                        handleSquareClick(actualRank, actualFile, e);
                      }}
                      style={{
                        cursor: readOnly ? 'default' : (isClickEnabled ? 'pointer' : (isDragEnabled ? 'grab' : 'default')),
                        pointerEvents: readOnly ? 'none' : 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                      }}
                    >
                      <img
                        src={getPieceImage(piece)}
                        alt={`${piece.color} ${piece.type}`}
                        className="w-full h-full object-contain pointer-events-none select-none transition-all duration-150"
                        style={{
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          zIndex: isSelected ? 10 : 1,
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          pointerEvents: 'none', // Ensure image doesn't block mouse events
                        }}
                        draggable={false}
                      />
                    </div>
                  );
                })()}

                {/* Coordinates */}
                {showCoordinates && (
                  <>
                    {/* File labels (a-h) */}
                    {displayRank === 7 && (
                      <div
                        className="absolute bottom-0 right-1 text-[10px] font-bold pointer-events-none select-none"
                        style={{
                          color: squareColor === 'dark' ? '#d7d7d7' : '#4a4a4a',
                        }}
                      >
                        {'abcdefgh'[displayFile]}
                      </div>
                    )}
                    {/* Rank labels (1-8) */}
                    {displayFile === 0 && (
                      <div
                        className="absolute top-0 left-1 text-[10px] font-bold pointer-events-none select-none"
                        style={{
                          color: squareColor === 'dark' ? '#d7d7d7' : '#4a4a4a',
                        }}
                      >
                        {8 - displayRank}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
        
        {/* Arrow overlays */}
        {arrows.length > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width, height: width, zIndex: 5 }}
          >
            {arrows.map((arrow, idx) => {
              const path = getArrowPath(arrow.startSquare, arrow.endSquare);
              if (!path) return null;
              return (
                <path
                  key={idx}
                  d={path}
                  stroke={arrow.color || 'rgba(255, 170, 0, 0.5)'}
                  strokeWidth={squareSize * 0.08}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>
        )}
        
        {/* Temporary arrow being drawn */}
        {arrowStart && dragOverSquare && arrowStart !== dragOverSquare && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width, height: width, zIndex: 6 }}
          >
            <path
              d={getArrowPath(arrowStart, dragOverSquare) || ''}
              stroke="rgba(255, 170, 0, 0.7)"
              strokeWidth={squareSize * 0.08}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        
        {/* Animated pieces layer */}
        {Array.from(animatingPieces.entries()).map(([key, anim]) => {
          const fromCoords = squareToRankFile(anim.from);
          const toCoords = squareToRankFile(anim.to);
          
          // Convert to display coordinates
          const fromDisplayRank = orientation === 'white' ? fromCoords.rank : 7 - fromCoords.rank;
          const fromDisplayFile = orientation === 'white' ? fromCoords.file : 7 - fromCoords.file;
          const toDisplayRank = orientation === 'white' ? toCoords.rank : 7 - toCoords.rank;
          const toDisplayFile = orientation === 'white' ? toCoords.file : 7 - toCoords.file;
          
          const fromX = fromDisplayFile * squareSize;
          const fromY = fromDisplayRank * squareSize;
          const toX = toDisplayFile * squareSize;
          const toY = toDisplayRank * squareSize;
          
          const dx = toX - fromX;
          const dy = toY - fromY;
          
          return (
            <AnimatedPiece
              key={key}
              fromX={fromX}
              fromY={fromY}
              dx={dx}
              dy={dy}
              piece={anim.piece}
              squareSize={squareSize}
              animationDuration={animationDuration}
              getPieceImage={getPieceImage}
            />
          );
        })}
        
        {/* Captured pieces (fade out) */}
        {Array.from(capturedPieces.entries()).map(([square, { piece }]) => {
          const coords = squareToRankFile(square);
          const displayRank = orientation === 'white' ? coords.rank : 7 - coords.rank;
          const displayFile = orientation === 'white' ? coords.file : 7 - coords.file;
          
          return (
            <div
              key={square}
              className="absolute pointer-events-none"
              style={{
                left: `${displayFile * squareSize}px`,
                top: `${displayRank * squareSize}px`,
                width: squareSize,
                height: squareSize,
                opacity: 0,
                transition: `opacity ${animationDuration}ms ease-out`,
                zIndex: 50,
              }}
            >
              <img
                src={getPieceImage(piece)}
                alt={`${piece.color} ${piece.type}`}
                className="w-full h-full object-contain object-center select-none"
                draggable={false}
              />
            </div>
          );
        })}
        
        {/* Ghost piece during drag - only show when actively dragging */}
        {draggedPiece && ghostPiecePosition && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${ghostPiecePosition.x}px`,
              top: `${ghostPiecePosition.y}px`,
              width: `${squareSize}px`,
              height: `${squareSize}px`,
              zIndex: 1000,
              opacity: 0.85,
              transform: 'scale(1.05)',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))',
              transition: 'none', // No transition during drag for smooth following
            }}
          >
            <img
              src={getPieceImage(draggedPiece.piece)}
              alt={`${draggedPiece.piece.color} ${draggedPiece.piece.type}`}
              className="w-full h-full object-contain object-center select-none"
              draggable={false}
              style={{
                pointerEvents: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
            />
          </div>
        )}
        
        {/* Resize handle */}
        {enableResize && (
          <div
            className={`absolute -bottom-1 -right-1 w-6 h-6 cursor-nwse-resize z-50 ${
              isResizing ? 'opacity-100' : 'opacity-0 hover:opacity-100'
            } transition-opacity`}
            onMouseDown={handleResizeMouseDown}
            style={{
              background: 'linear-gradient(135deg, transparent 40%, rgba(249, 115, 22, 0.8) 40%, rgba(249, 115, 22, 0.8) 60%, transparent 60%)',
            }}
          >
            {/* Visual indicator lines */}
            <div className="absolute bottom-0 right-0 w-full h-full pointer-events-none">
              <svg width="24" height="24" viewBox="0 0 24 24" className="opacity-80">
                <line x1="20" y1="4" x2="4" y2="20" stroke="rgba(249, 115, 22, 1)" strokeWidth="2" />
                <line x1="24" y1="8" x2="8" y2="24" stroke="rgba(249, 115, 22, 1)" strokeWidth="2" />
                <line x1="16" y1="0" x2="0" y2="16" stroke="rgba(249, 115, 22, 1)" strokeWidth="2" />
              </svg>
            </div>
          </div>
        )}
        
        {/* Scale indicator - shows current size percentage */}
        {enableResize && isResizing && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none z-50">
            {Math.round((internalWidth / width) * 100)}%
          </div>
        )}
      </div>
    </div>
  );
}
