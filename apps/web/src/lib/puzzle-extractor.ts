import { Chess } from 'chess.js';
import { db } from '@chess960/db';
import { getChess960Position } from '@chess960/utils';

export interface PuzzleCandidate {
  gameId: string;
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
}

/**
 * Extract puzzle candidates from a completed game.
 * Looks for tactical positions where a player can gain material or checkmate.
 */
export async function extractPuzzleFromGame(gameId: string): Promise<PuzzleCandidate | null> {
  try {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        moves: {
          orderBy: { ply: 'asc' },
          select: { uci: true, ply: true },
        },
      },
    });

    if (!game || !game.moves || game.moves.length < 10) {
      return null; // Need at least some moves for a puzzle
    }

    // Compute initial FEN
    let initialFen: string;
    if (game.variant === 'CHESS960' && game.chess960Position) {
      try {
        const chess960Pos = getChess960Position(game.chess960Position);
        initialFen = chess960Pos.fen;
      } catch (error) {
        console.error('Error computing Chess960 FEN:', error);
        return null;
      }
    } else {
      initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }

    const chess = new Chess(initialFen);
    const moves = game.moves.map((m) => m.uci);

    // Look for tactical positions (material gains, checkmates, etc.)
    // Start from move 10 to avoid opening theory
    for (let i = 10; i < moves.length - 2; i++) {
      // Replay to position before the tactical move
      const tempChess = new Chess(initialFen);
      for (let j = 0; j < i; j++) {
        try {
          const move = moves[j];
          const from = move.slice(0, 2);
          const to = move.slice(2, 4);
          const promotion = move.length > 4 ? move[4] : undefined;
          tempChess.move({ from, to, promotion });
        } catch (error) {
          break; // Invalid move, skip this game
        }
      }

      // Check if there's a tactical opportunity
      const currentFen = tempChess.fen();
      const currentTurn = tempChess.turn();
      
      // Look ahead: if the next move is a capture or check, it might be a puzzle
      if (i < moves.length) {
        const nextMove = moves[i];
        const from = nextMove.slice(0, 2);
        const to = nextMove.slice(2, 4);
        const promotion = nextMove.length > 4 ? nextMove[4] : undefined;

        try {
          // Check if this is a valid move
          const moveObj = tempChess.move({ from, to, promotion });
          
          if (moveObj) {
            // Check if this is a tactical move (capture, check, or checkmate)
            const isTactical = moveObj.captured || tempChess.isCheck() || tempChess.isCheckmate() || moveObj.promotion;
            
            if (isTactical) {
              // Check if this leads to checkmate or is a significant capture/check
              const leadsToMate = tempChess.isCheckmate();
              
              // Only create puzzle if it's interesting (checkmate, capture, or check)
              if (leadsToMate || moveObj.captured || tempChess.isCheck()) {
                // Rating based on game ratings
                const avgRating = Math.round(
                  ((game.whiteRatingBefore || 1500) + (game.blackRatingBefore || 1500)) / 2
                );

                // Solution is the move sequence (at least 1 move, preferably 2-3)
                const solutionMoves: string[] = [nextMove];
                
                // Add follow-up moves if they're part of the tactic (up to 2 more moves)
                for (let followUp = 1; followUp <= 2 && (i + followUp) < moves.length; followUp++) {
                  const followUpMove = moves[i + followUp];
                  const followFrom = followUpMove.slice(0, 2);
                  const followTo = followUpMove.slice(2, 4);
                  const followPromotion = followUpMove.length > 4 ? followUpMove[4] : undefined;
                  
                  try {
                    const followMoveObj = tempChess.move({ from: followFrom, to: followTo, promotion: followPromotion });
                    if (followMoveObj && (followMoveObj.captured || tempChess.isCheck() || tempChess.isCheckmate())) {
                      solutionMoves.push(followUpMove);
                    } else {
                      break; // Not part of the tactic
                    }
                  } catch {
                    break;
                  }
                }

                return {
                  gameId: game.id,
                  fen: currentFen,
                  solution: nextMove,
                  moves: solutionMoves,
                  rating: Math.max(1200, Math.min(2500, avgRating)),
                };
              }
            }
          }
        } catch (error) {
          // Invalid move, continue
          continue;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting puzzle from game:', gameId, error);
    return null;
  }
}

/**
 * Create a puzzle from a candidate and save it to the database.
 */
export async function createPuzzleFromCandidate(candidate: PuzzleCandidate): Promise<string | null> {
  try {
    const puzzle = await (db as any).puzzle.create({
      data: {
        gameId: candidate.gameId,
        fen: candidate.fen,
        solution: candidate.solution,
        moves: candidate.moves,
        rating: candidate.rating,
        plays: 0,
        votes: 0,
      },
    });

    return puzzle.id;
  } catch (error) {
    console.error('Error creating puzzle:', error);
    return null;
  }
}

