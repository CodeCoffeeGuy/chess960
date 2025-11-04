/**
 * Chess960 (Fischer Random Chess) position generator and utilities
 *
 * Rules for generating valid Chess960 positions:
 * 1. Bishops must be on opposite colors
 * 2. King must be between the two rooks
 * 3. All pieces on the back rank (pawns stay on 2nd/7th rank)
 * 4. There are exactly 960 possible starting positions
 */

const PIECE_SYMBOLS = {
  ROOK: 'R',
  KNIGHT: 'N',
  BISHOP: 'B',
  QUEEN: 'Q',
  KING: 'K',
} as const;

export interface Chess960Position {
  position: number; // 1-960
  fen: string;
  pieces: string[]; // Array of 8 pieces representing back rank
}

/**
 * Generate a random Chess960 position number (1-960)
 */
export function generateRandomPosition(): number {
  return Math.floor(Math.random() * 960) + 1;
}

/**
 * Convert position number (1-960) to back rank piece arrangement
 * Uses Scharnagl's numbering scheme
 */
export function positionToBackRank(n: number): string[] {
  if (n < 1 || n > 960) {
    throw new Error('Position must be between 1 and 960');
  }

  // Convert to 0-indexed
  n = n - 1;

  const pieces = new Array(8).fill('');

  // Step 1: Place bishops on opposite colored squares
  // Light-squared bishop (squares 1, 3, 5, 7 -> indices 1, 3, 5, 7)
  const lightSquares = [1, 3, 5, 7];
  const lightBishopIdx = n % 4;
  pieces[lightSquares[lightBishopIdx]] = PIECE_SYMBOLS.BISHOP;
  n = Math.floor(n / 4);

  // Dark-squared bishop (squares 0, 2, 4, 6 -> indices 0, 2, 4, 6)
  const darkSquares = [0, 2, 4, 6];
  const darkBishopIdx = n % 4;
  pieces[darkSquares[darkBishopIdx]] = PIECE_SYMBOLS.BISHOP;
  n = Math.floor(n / 4);

  // Step 2: Place queen on remaining empty square
  const emptySquares = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  const queenIdx = n % 6;
  pieces[emptySquares[queenIdx]] = PIECE_SYMBOLS.QUEEN;
  n = Math.floor(n / 6);

  // Step 3: Place knights on remaining empty squares
  const remainingSquares = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);

  // There are 5 empty squares, we need to place 2 knights
  // This gives us C(5,2) = 10 combinations
  const knightPlacements = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 2], [1, 3], [1, 4],
    [2, 3], [2, 4],
    [3, 4]
  ];

  const knightPlacement = knightPlacements[n];
  pieces[remainingSquares[knightPlacement[0]]] = PIECE_SYMBOLS.KNIGHT;
  pieces[remainingSquares[knightPlacement[1]]] = PIECE_SYMBOLS.KNIGHT;

  // Step 4: Place rooks and king on the last 3 empty squares
  // King must be between rooks (R-K-R pattern)
  const lastSquares = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[lastSquares[0]] = PIECE_SYMBOLS.ROOK;
  pieces[lastSquares[1]] = PIECE_SYMBOLS.KING;
  pieces[lastSquares[2]] = PIECE_SYMBOLS.ROOK;

  return pieces;
}

/**
 * Convert back rank pieces to FEN notation for starting position
 * FEN format: rank8/rank7/.../rank2/rank1
 * Standard FEN: rank 8 = black pieces (uppercase), rank 1 = white pieces (lowercase)
 * This ensures white pieces appear at bottom (rank 1) and black at top (rank 8) when displayed
 */
export function backRankToFEN(pieces: string[]): string {
  // Join pieces array into string: uppercase for black, lowercase for white
  const backRank = pieces.join('');
  const whiteBackRank = backRank.toLowerCase();
  const blackBackRank = backRank.toUpperCase();

  // Standard FEN format: rank8/rank7/.../rank2/rank1
  // chess.js interprets: first rank in FEN (rank8) = board[0], last rank (rank1) = board[7]
  // For correct display: board[0] should be black (rank 8), board[7] should be white (rank 1)
  // Testing shows chess.js wants: lowercase at rank 8 (first), uppercase at rank 1 (last)
  // This is inverted from standard FEN notation, but matches chess.js behavior
  return `${whiteBackRank}/pppppppp/8/8/8/8/PPPPPPPP/${blackBackRank} w KQkq - 0 1`;
}

/**
 * Get Chess960 position by number
 */
export function getChess960Position(n: number): Chess960Position {
  const pieces = positionToBackRank(n);
  const fen = backRankToFEN(pieces);

  return {
    position: n,
    fen,
    pieces,
  };
}

/**
 * Get a random Chess960 position
 */
export function getRandomChess960Position(): Chess960Position {
  const position = generateRandomPosition();
  return getChess960Position(position);
}

/**
 * Get the standard chess starting position (position 518 in Chess960)
 */
export function getStandardPosition(): Chess960Position {
  return getChess960Position(518);
}

/**
 * Validate if a back rank arrangement is a valid Chess960 position
 */
export function isValidChess960Position(pieces: string[]): boolean {
  if (pieces.length !== 8) return false;

  // Count pieces
  const counts = {
    R: 0, N: 0, B: 0, Q: 0, K: 0,
  };

  let lightBishop = false;
  let darkBishop = false;
  let firstRook = -1;
  let kingPos = -1;
  let secondRook = -1;

  for (let i = 0; i < 8; i++) {
    const piece = pieces[i];
    if (!['R', 'N', 'B', 'Q', 'K'].includes(piece)) return false;

    counts[piece as keyof typeof counts]++;

    if (piece === 'B') {
      // Check bishop color (even index = dark, odd = light)
      if (i % 2 === 0) darkBishop = true;
      else lightBishop = true;
    }

    if (piece === 'R') {
      if (firstRook === -1) firstRook = i;
      else secondRook = i;
    }

    if (piece === 'K') {
      kingPos = i;
    }
  }

  // Validate piece counts
  if (counts.R !== 2 || counts.N !== 2 || counts.B !== 2 || counts.Q !== 1 || counts.K !== 1) {
    return false;
  }

  // Validate bishops on opposite colors
  if (!lightBishop || !darkBishop) return false;

  // Validate king between rooks
  if (kingPos <= firstRook || kingPos >= secondRook) return false;

  return true;
}

/**
 * Get castling rights file indices for Chess960
 * Returns the file indices (0-7) for the rooks
 */
export function getCastlingRookFiles(pieces: string[]): { kingside: number; queenside: number } {
  const rooks: number[] = [];

  for (let i = 0; i < 8; i++) {
    if (pieces[i] === 'R') {
      rooks.push(i);
    }
  }

  if (rooks.length !== 2) {
    throw new Error('Invalid position: must have exactly 2 rooks');
  }

  return {
    queenside: rooks[0], // Left rook
    kingside: rooks[1],  // Right rook
  };
}
