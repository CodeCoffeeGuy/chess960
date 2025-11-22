import { Chess } from 'chess.js';

/**
 * Validates that a puzzle position is realistic for the given rating level.
 * Rejects positions with exposed kings, unrealistic material imbalances, etc.
 */
export function validatePuzzlePosition(
  fen: string,
  targetRating: number
): { valid: boolean; reason?: string } {
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    
    // Check if game is already over
    if (chess.isGameOver()) {
      return { valid: false, reason: 'Game is already over' };
    }
    
    // Count material
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let whiteKingSquare: string | null = null;
    let blackKingSquare: string | null = null;
    
    const pieceValues: Record<string, number> = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    };
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const value = pieceValues[piece.type.toLowerCase()] || 0;
          if (piece.color === 'w') {
            whiteMaterial += value;
            if (piece.type === 'k') {
              whiteKingSquare = String.fromCharCode(97 + file) + (8 - rank);
            }
          } else {
            blackMaterial += value;
            if (piece.type === 'k') {
              blackKingSquare = String.fromCharCode(97 + file) + (8 - rank);
            }
          }
        }
      }
    }
    
    // Check material balance - shouldn't be too imbalanced for lower ratings
    const materialDiff = Math.abs(whiteMaterial - blackMaterial);
    if (targetRating < 1600 && materialDiff > 5) {
      return { valid: false, reason: 'Material too imbalanced for rating' };
    }
    if (targetRating < 1800 && materialDiff > 8) {
      return { valid: false, reason: 'Material too imbalanced for rating' };
    }
    
    // Calculate total pieces (used for multiple validations)
    const totalPieces = board.flat().filter(p => p !== null).length;
    
    // Check king safety - kings shouldn't be exposed unless it's a high-rated tactical puzzle
    if (whiteKingSquare && blackKingSquare) {
      const whiteKingExposed = isKingExposed(chess, whiteKingSquare, 'w', board);
      const blackKingExposed = isKingExposed(chess, blackKingSquare, 'b', board);
      
      // Check if king is in an unrealistic position (e.g., far from starting position early in game)
      const whiteKingRank = parseInt(whiteKingSquare[1]);
      const blackKingRank = parseInt(blackKingSquare[1]);
      
      // If there are still many pieces (mid-game), kings should be relatively safe
      // White king should be on ranks 1-3, black king on ranks 6-8 in mid-game
      if (totalPieces >= 20) {
        // Mid-game with many pieces - kings should be in safe positions
        if (whiteKingRank > 3 || blackKingRank < 6) {
          return { valid: false, reason: 'King in unrealistic position for mid-game' };
        }
      }
      
      // For lower ratings (< 1800), reject positions with exposed kings
      // For higher ratings, allow exposed kings only if it's part of a tactical sequence
      if (targetRating < 1800) {
        if (whiteKingExposed || blackKingExposed) {
          return { valid: false, reason: 'King exposed - unrealistic for rating' };
        }
      } else if (targetRating < 2000) {
        // For medium ratings, allow one exposed king but not both
        if (whiteKingExposed && blackKingExposed) {
          return { valid: false, reason: 'Both kings exposed - unrealistic' };
        }
      }
    }
    
    // Check piece count - should have reasonable number of pieces
    // (totalPieces already calculated above)
    if (totalPieces < 6) {
      // Too few pieces - likely endgame, which is fine but should be validated separately
      // For now, allow it
    }
    
    // Check for unrealistic positions (e.g., too many pieces hanging)
    const hangingPieces = countHangingPieces(chess, board);
    if (targetRating < 1600 && hangingPieces > 2) {
      return { valid: false, reason: 'Too many hanging pieces - unrealistic' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Error validating position' };
  }
}

/**
 * Check if a king is exposed (not well protected)
 */
function isKingExposed(
  chess: Chess,
  kingSquare: string,
  color: 'w' | 'b',
  board: (any | null)[][]
): boolean {
  // Get king's position
  const [file, rank] = [kingSquare.charCodeAt(0) - 97, 8 - parseInt(kingSquare[1])];
  
  // Count pieces defending the king
  let defenders = 0;
  
  // Check squares around the king
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (const [df, dr] of directions) {
    const newFile = file + df;
    const newRank = rank + dr;
    
    if (newFile >= 0 && newFile < 8 && newRank >= 0 && newRank < 8) {
      const piece = board[newRank][newFile];
      if (piece && piece.color === color) {
        defenders++;
      }
    }
  }
  
  // Check if king is on back rank with no pawn shield (for lower ratings)
  const isOnBackRank = (color === 'w' && rank === 7) || (color === 'b' && rank === 0);
  if (isOnBackRank) {
    // Check for pawn shield
    const pawnRank = color === 'w' ? rank - 1 : rank + 1;
    let pawnShield = 0;
    for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
      const piece = board[pawnRank][f];
      if (piece && piece.type === 'p' && piece.color === color) {
        pawnShield++;
      }
    }
    
    // If king is on back rank with no pawn shield and few defenders, it's exposed
    if (pawnShield === 0 && defenders < 2) {
      return true;
    }
  }
  
  // King is exposed if it has very few defenders and is in the open
  // Also check if king is in center or advanced position without good reason
  const kingRank = parseInt(kingSquare[1]);
  const kingFile = kingSquare.charCodeAt(0) - 97;
  
  // Kings in center files (c-f) should have more defenders
  const isInCenter = kingFile >= 2 && kingFile <= 5;
  if (isInCenter && defenders < 3) {
    return true; // Center king needs more protection
  }
  
  // King is exposed if it has very few defenders
  return defenders < 2;
}

/**
 * Count pieces that are hanging (can be captured for free)
 */
function countHangingPieces(chess: Chess, board: (any | null)[][]): number {
  let hanging = 0;
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece || piece.type === 'k') continue; // Skip empty squares and kings
      
      const square = String.fromCharCode(97 + file) + (8 - rank);
      
      // Get all moves to see what can attack this square
      const allMoves = chess.moves({ verbose: true });
      
      // Count attackers (opponent pieces that can capture)
      let attackers = 0;
      let defenders = 0;
      
      for (const move of allMoves) {
        if (move.to === square) {
          if (move.color !== piece.color) {
            attackers++;
          } else {
            defenders++;
          }
        }
      }
      
      // If more attackers than defenders and it's not a trade, it's hanging
      if (attackers > defenders && defenders === 0) {
        hanging++;
      }
    }
  }
  
  return hanging;
}

