import { Chess } from 'chess.js';
import type { Puzzle, PuzzleCandidate, GeneratorOptions, StockfishEngine } from './types';
import { validatePuzzlePosition } from './position-validator';

/**
 * Generate puzzles by having Stockfish play against Stockfish with different skill levels.
 * The stronger Stockfish plays at the target puzzle rating, creating realistic positions.
 */
export class StockfishVsStockfishGenerator {
  private engine1: StockfishEngine; // Stronger engine (target rating)
  private engine2: StockfishEngine; // Weaker engine (target rating - 50-100 points)

  constructor(engine1: StockfishEngine, engine2: StockfishEngine) {
    this.engine1 = engine1;
    this.engine2 = engine2;
  }

  /**
   * Map puzzle rating to Stockfish skill level (0-20)
   * Higher ratings = higher skill levels
   */
  private ratingToSkillLevel(rating: number): number {
    // Map ratings to skill levels:
    // 1200 → 8, 1250 → 9, 1300 → 10, 1350 → 11, etc.
    // Formula: skillLevel = (rating - 1200) / 50 + 8, clamped to 0-20
    const skillLevel = Math.max(0, Math.min(20, Math.round((rating - 1200) / 50 + 8)));
    return skillLevel;
  }

  /**
   * Generate a puzzle by playing Stockfish vs Stockfish
   */
  async generatePuzzleFromGame(options: {
    chess960Position?: number;
    getChess960Position: (n: number) => { fen: string; position: number };
    targetRating: number;
    minMoves?: number;
    maxMoves?: number;
    depth?: number;
  }): Promise<PuzzleCandidate | null> {
    try {
      // Generate random Chess960 position
      const positionNum = options.chess960Position ?? 
        (Math.floor(Math.random() * 960) + 1);
      
      const chess960Pos = options.getChess960Position(positionNum);
      const chess = new Chess(chess960Pos.fen);

      // Set skill levels based on target rating
      const strongerSkill = this.ratingToSkillLevel(options.targetRating);
      const weakerSkill = Math.max(0, strongerSkill - 2); // Weaker by 2 skill levels (~100 rating points)

      if (this.engine1.setSkillLevel) {
        await this.engine1.setSkillLevel(strongerSkill);
      }
      if (this.engine2.setSkillLevel) {
        await this.engine2.setSkillLevel(weakerSkill);
      }

      // Play moves: stronger engine is white, weaker is black
      // This creates positions where white (stronger) has tactical opportunities
      const minMoves = options.minMoves ?? 20;
      const maxMoves = options.maxMoves ?? 40;
      const targetMoves = minMoves + Math.floor(Math.random() * (maxMoves - minMoves));
      
      const moveDepth = 5; // Reduced depth for faster game play
      const moveTimeout = 3000; // 3 seconds per move (reduced for speed)
      const gameMoves: string[] = [];

      // Play the game
      for (let moveNum = 0; moveNum < targetMoves && !chess.isGameOver(); moveNum++) {
        const isWhiteMove = chess.turn() === 'w';
        const engine = isWhiteMove ? this.engine1 : this.engine2;

        try {
          const analysis = await engine.analyzePosition(chess.fen(), {
            depth: moveDepth,
            time: moveTimeout,
          });

          if (!analysis.bestMove) {
            // Engine couldn't find a move - game might be over
            break;
          }

          const move = analysis.bestMove.uci;
          const from = move.slice(0, 2);
          const to = move.slice(2, 4);
          const promotion = move.length > 4 ? move[4] : undefined;

          const moveObj = chess.move({ from, to, promotion: promotion as any });
          if (!moveObj) {
            break;
          }

          gameMoves.push(move);

          // Check piece count to determine if we're in endgame
          const pieceCount = chess.board().flat().filter(p => p !== null).length;
          const isEndgame = pieceCount <= 12;
          
          // Start checking for puzzle positions after minMoves
          // But prioritize endgame positions (≤12 pieces) if we've played enough moves
          if (moveNum >= minMoves - 1) {
            // If it's an endgame position, always check it
            // Otherwise, check every 5 moves to avoid checking too often
            if (isEndgame || moveNum % 5 === 0) {
              // Analyze current position for puzzle potential
              const puzzleCandidate = await this.analyzeForPuzzle(
                chess.fen(),
                chess960Pos,
                options.targetRating,
                options.depth ?? 12
              );

              if (puzzleCandidate) {
                return puzzleCandidate;
              }
            }
          }
        } catch (error) {
          // If engine fails, try to continue or break
          if (process.env.NODE_ENV === 'development') {
            console.log(`  Engine error at move ${moveNum}: ${error instanceof Error ? error.message : error}`);
          }
          break;
        }
      }

      // If we didn't find a puzzle during the game, return null
      return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Error generating puzzle from Stockfish game: ${error instanceof Error ? error.message : error}`);
      }
      return null;
    }
  }

  /**
   * Analyze a position to see if it makes a good puzzle
   */
  private async analyzeForPuzzle(
    fen: string,
    chess960Pos: { fen: string; position: number },
    targetRating: number,
    depth: number
  ): Promise<PuzzleCandidate | null> {
    try {
      // Validate position is realistic
      const validation = validatePuzzlePosition(fen, targetRating);
      if (!validation.valid) {
        return null;
      }

      // Analyze with stronger engine to find best move
      const analysis = await this.engine1.analyzePosition(fen, {
        depth: Math.min(depth, 10), // Cap depth at 10 for faster analysis
        multipv: 2, // Reduced from 3 to 2 for speed
        time: 15000, // Reduced from 30s to 15s
      });

      if (!analysis.bestMove || analysis.evaluation === undefined) {
        return null;
      }

      const bestMove = analysis.bestMove.uci;
      const chess = new Chess(fen);
      const moveObj = chess.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove.length > 4 ? bestMove[4] : undefined,
      });

      if (!moveObj) {
        return null;
      }

      // Check if it's tactical
      const isTactical = 
        moveObj.captured || 
        chess.isCheck() || 
        chess.isCheckmate() ||
        Math.abs(analysis.evaluation) > 150;

      if (!isTactical) {
        return null;
      }

      // Build solution moves
      const solutionMoves: string[] = [bestMove];
      if (chess.isCheck() && !chess.isCheckmate()) {
        // Try to find follow-up
        try {
          const followUp = await this.engine1.analyzePosition(chess.fen(), {
            depth: depth - 2,
            time: 20000,
          });
          if (followUp.bestMove) {
            solutionMoves.push(followUp.bestMove.uci);
          }
        } catch {
          // Continue without follow-up
        }
      }

      // Calculate rating (use target rating as base, adjust based on complexity)
      let rating = targetRating;
      const evalAbs = Math.abs(analysis.evaluation);
      const pieceCount = chess.board().flat().filter(p => p !== null).length;
      const isComplex = pieceCount >= 20;

      if (chess.isCheckmate()) {
        rating = isComplex ? targetRating + 200 : targetRating + 100;
      } else if (evalAbs >= 400 && isComplex) {
        rating = targetRating + 100;
      } else if (evalAbs >= 250) {
        rating = targetRating + 50;
      }

      // Final validation
      const finalValidation = validatePuzzlePosition(fen, rating);
      if (!finalValidation.valid) {
        return null;
      }

      return {
        fen,
        solution: bestMove,
        moves: solutionMoves,
        rating: Math.max(1200, Math.min(2500, rating)),
        evaluation: analysis.evaluation,
        initialFen: chess960Pos.fen,
        chess960Position: chess960Pos.position,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate multiple puzzles with different target ratings
   */
  async generatePuzzles(options: GeneratorOptions & {
    getChess960Position: (n: number) => { fen: string; position: number };
    targetRatings?: number[]; // Array of target ratings (e.g., [1200, 1250, 1300, ...])
  }): Promise<Puzzle[]> {
    const count = options.count ?? 50;
    const targetRatings = options.targetRatings ?? 
      // Generate ratings from 1200 to 2000 in steps of 50
      Array.from({ length: 17 }, (_, i) => 1200 + i * 50);

    const puzzles: Puzzle[] = [];
    let attempts = 0;
    const maxAttempts = count * 10;

    // Distribute puzzles across ratings
    const puzzlesPerRating = Math.ceil(count / targetRatings.length);

    for (const targetRating of targetRatings) {
      if (puzzles.length >= count) break;

      let puzzlesForThisRating = 0;
      const targetForThisRating = Math.min(puzzlesPerRating, count - puzzles.length);

      while (puzzlesForThisRating < targetForThisRating && attempts < maxAttempts) {
        attempts++;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`  [Attempt ${attempts}] Generating puzzle at rating ${targetRating} (${puzzlesForThisRating + 1}/${targetForThisRating})...`);
        }

        try {
          const candidate = await this.generatePuzzleFromGame({
            chess960Position: options.chess960Position,
            getChess960Position: options.getChess960Position,
            targetRating,
            minMoves: options.minMoves ?? 20,
            maxMoves: options.maxMoves ?? 40,
            depth: options.depth ?? 12,
          });

          if (candidate) {
            // Check for duplicates
            const duplicate = puzzles.find(p => p.fen === candidate.fen);
            if (!duplicate) {
              const puzzle: Puzzle = {
                fen: candidate.fen,
                solution: candidate.solution,
                moves: candidate.moves,
                rating: candidate.rating,
                initialFen: candidate.initialFen,
                chess960Position: candidate.chess960Position,
              };
              
              puzzles.push(puzzle);
              puzzlesForThisRating++;

              if (options.onProgress) {
                options.onProgress(puzzles.length, count, candidate);
              }
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`  Error in attempt ${attempts}: ${error instanceof Error ? error.message : error}`);
          }
        }
      }
    }

    return puzzles;
  }
}



