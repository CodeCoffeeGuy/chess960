import { Chess } from 'chess.js';

/**
 * Parse PGN solution string into UCI moves array
 * Supports both full PGN format and simple move notation
 */
export function parsePgnToUci(pgn: string, initialFen?: string): string[] {
  try {
    // Try loading as full PGN first
    const chess = new Chess(initialFen);
    try {
      chess.loadPgn(pgn);
      // Reset to initial position and replay moves to get UCI
      const tempChess = new Chess(initialFen);
      const history = chess.history({ verbose: true });
      const uciMoves: string[] = [];
      
      for (const move of history) {
        try {
          const replayedMove = tempChess.move(move);
          if (replayedMove) {
            uciMoves.push(`${replayedMove.from}${replayedMove.to}${replayedMove.promotion || ''}`);
          }
        } catch {
          // Skip invalid moves
          continue;
        }
      }
      
      return uciMoves;
    } catch {
      // If full PGN fails, try parsing as simple move notation (space-separated SAN)
      const chess2 = new Chess(initialFen);
      const moves = pgn.trim().split(/\s+/).filter(m => m.length > 0);
      const uciMoves: string[] = [];
      
      for (const moveStr of moves) {
        // Remove move numbers (e.g., "1.", "2.")
        const cleanMove = moveStr.replace(/^\d+\.\s*/, '').trim();
        if (!cleanMove) continue;
        
        try {
          const move = chess2.move(cleanMove);
          if (move) {
            uciMoves.push(`${move.from}${move.to}${move.promotion || ''}`);
          }
        } catch {
          // Skip invalid moves
          continue;
        }
      }
      
      return uciMoves;
    }
  } catch (error) {
    console.error('Error parsing PGN:', error);
    return [];
  }
}

/**
 * Validate a move against the solution
 * Returns: { isValid: boolean, isComplete: boolean, expectedMove?: string }
 */
export function validateMoveAgainstSolution(
  userMove: string,
  currentMoveIndex: number,
  solutionMoves: string[]
): { isValid: boolean; isComplete: boolean; expectedMove?: string } {
  if (currentMoveIndex >= solutionMoves.length) {
    return { isValid: false, isComplete: true };
  }

  const expectedMove = solutionMoves[currentMoveIndex];
  const isValid = userMove === expectedMove;
  const isComplete = isValid && currentMoveIndex === solutionMoves.length - 1;

  return {
    isValid,
    isComplete,
    expectedMove: isValid ? undefined : expectedMove,
  };
}

/**
 * Calculate score for a practice session
 * Score is based on:
 * - Number of correct moves (without hints)
 * - Number of wrong attempts
 * - Completion of all lessons
 */
export function calculatePracticeScore(
  lessonsCompleted: number,
  totalLessons: number,
  totalMoves: number,
  correctMoves: number,
  wrongAttempts: number,
  hintsUsed: number
): number {
  if (totalLessons === 0) return 0;

  // Base score from completion percentage
  const completionScore = (lessonsCompleted / totalLessons) * 60;

  // Accuracy score (up to 30 points)
  const accuracy = totalMoves > 0 ? correctMoves / totalMoves : 0;
  const accuracyScore = accuracy * 30;

  // Penalty for wrong attempts (up to -10 points)
  const wrongPenalty = Math.min(wrongAttempts * 2, 10);

  // Penalty for hints used (up to -10 points)
  const hintPenalty = Math.min(hintsUsed * 1, 10);

  const finalScore = Math.max(0, Math.min(100, 
    completionScore + 
    accuracyScore - 
    wrongPenalty - 
    hintPenalty
  ));

  return Math.round(finalScore);
}

/**
 * Convert UCI move to SAN notation for display
 */
export function uciToSan(uci: string, fen: string): string | null {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    
    const move = chess.move({ from, to, promotion });
    return move ? move.san : null;
  } catch {
    return null;
  }
}

