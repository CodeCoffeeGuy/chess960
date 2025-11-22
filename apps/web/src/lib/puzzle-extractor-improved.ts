import { Chess } from 'chess.js';
import { db } from '@chess960/db';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { detectPuzzleThemes } from './puzzle-theme-detector';
import { validatePuzzlePosition } from './puzzle-position-validator';

export interface PuzzleCandidate {
  gameId: string;
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
  themes?: string[];
  evaluation?: number;
}

/**
 * Improved puzzle extraction with Stockfish validation.
 * This ensures puzzles are actually tactical and have a clear solution.
 */
export async function extractPuzzleFromGameWithStockfish(
  gameId: string,
  engine: StockfishEngine
): Promise<PuzzleCandidate | null> {
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

    if (!game || !game.moves || game.moves.length < 20) {
      return null; // Need at least 20 moves for realistic positions
    }
    
    // Filter games by rating - only use games from players with reasonable ratings
    const avgRating = Math.round(
      ((game.whiteRatingBefore || 1500) + (game.blackRatingBefore || 1500)) / 2
    );
    
    // Skip games with very low average rating (likely lots of blunders)
    if (avgRating < 1200) {
      return null;
    }
    
    // Skip games that ended too quickly (likely resignation or blunder)
    if (game.moves.length < 20) {
      return null;
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

    // Look for tactical positions starting from move 15 (mid-game)
    // Skip early opening positions which are less realistic
    const startMove = Math.max(15, Math.floor(game.moves.length * 0.2)); // At least 20% into the game
    const endMove = Math.min(moves.length - 3, Math.floor(game.moves.length * 0.8)); // Up to 80% of game
    
    for (let i = startMove; i < endMove; i++) {
      // Replay to position before the potential tactical move
      const tempChess = new Chess(initialFen);
      for (let j = 0; j < i; j++) {
        try {
          const move = moves[j];
          const from = move.slice(0, 2);
          const to = move.slice(2, 4);
          const promotion = move.length > 4 ? move[4] : undefined;
          tempChess.move({ from, to, promotion });
        } catch (error) {
          break;
        }
      }

      const currentFen = tempChess.fen();
      
      // Analyze position with Stockfish
      try {
        const analysis = await engine.analyzePosition(currentFen, {
          depth: 10,
          multipv: 3,
          time: 20000, // 20 seconds max
        });

        if (!analysis.bestMove || analysis.evaluation === undefined) {
          continue;
        }

        const bestMove = analysis.bestMove.uci;
        const evalAbs = Math.abs(analysis.evaluation);

        // Check if this is a good puzzle position
        // Must have significant advantage or be checkmate
        if (evalAbs < 150 && !analysis.bestMove.mate) {
          continue; // Not significant enough
        }

        // Verify the best move matches what was played in the game
        const nextMove = moves[i];
        if (nextMove !== bestMove) {
          // Check if the played move is close in evaluation (within 100 centipawns)
          const altMove = analysis.alternativeMoves.find(m => m.uci === nextMove);
          if (!altMove || Math.abs(altMove.evaluation - analysis.evaluation) > 100) {
            continue; // Played move is not best or close to best
          }
        }

        // Verify the move is tactical
        const moveObj = tempChess.move({
          from: bestMove.slice(0, 2),
          to: bestMove.slice(2, 4),
          promotion: bestMove.length > 4 ? bestMove[4] : undefined,
        });

        if (!moveObj) {
          continue;
        }

        const isTactical =
          moveObj.captured ||
          tempChess.isCheck() ||
          tempChess.isCheckmate() ||
          evalAbs >= 200;

        if (!isTactical) {
          continue;
        }

        // Determine solution moves
        const solutionMoves: string[] = [bestMove];
        const isCheckmate = tempChess.isCheckmate();

        // If check but not mate, try to find follow-up
        if (tempChess.isCheck() && !isCheckmate && i + 1 < moves.length) {
          try {
            const followUpAnalysis = await engine.analyzePosition(tempChess.fen(), {
              depth: 8,
              time: 10000,
            });
            if (followUpAnalysis.bestMove) {
              solutionMoves.push(followUpAnalysis.bestMove.uci);
            }
          } catch {
            // Continue without follow-up
          }
        }

        // Calculate rating based on evaluation and complexity
        const pieceCount = tempChess.board().flat().filter(p => p !== null).length;
        let rating = 1500;

        if (isCheckmate) {
          rating = pieceCount >= 20 ? 2000 : 1800;
        } else if (evalAbs >= 400) {
          rating = pieceCount >= 20 ? 1900 : 1700;
        } else if (evalAbs >= 250) {
          rating = pieceCount >= 20 ? 1700 : 1500;
        } else {
          rating = 1400;
        }
        
        // Validate position is realistic for this rating
        const validation = validatePuzzlePosition(currentFen, rating);
        if (!validation.valid) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Position rejected: ${validation.reason} (rating: ${rating})`);
          }
          continue; // Skip this position
        }

        // Detect themes
        const themeResult = detectPuzzleThemes(
          currentFen,
          solutionMoves,
          analysis.evaluation,
          isCheckmate
        );

        return {
          gameId: game.id,
          fen: currentFen,
          solution: bestMove,
          moves: solutionMoves,
          rating: Math.max(1200, Math.min(2500, rating)),
          themes: themeResult.themes,
          evaluation: analysis.evaluation,
        };
      } catch (error) {
        // Timeout or error - skip this position
        if (error instanceof Error && error.message.includes('timeout')) {
          continue;
        }
        console.warn('Error analyzing position:', error);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting puzzle from game:', gameId, error);
    return null;
  }
}

/**
 * Create a puzzle from a candidate with themes
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
        themes: candidate.themes || [],
      },
    });

    return puzzle.id;
  } catch (error) {
    console.error('Error creating puzzle:', error);
    return null;
  }
}







