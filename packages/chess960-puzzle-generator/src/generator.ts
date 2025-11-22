import { Chess } from 'chess.js';
import type { Puzzle, PuzzleCandidate, GeneratorOptions, StockfishEngine } from './types';
import { validatePuzzlePosition } from './position-validator';

/**
 * Chess960 Puzzle Generator
 * 
 * Generates tactical puzzles by:
 * 1. Starting from random Chess960 positions
 * 2. Playing random moves to reach mid-game
 * 3. Using Stockfish to find tactical opportunities
 * 4. Creating puzzles with appropriate ratings
 */
export class Chess960PuzzleGenerator {
  private engine: StockfishEngine;
  private isReady = false;

  constructor(engine: StockfishEngine) {
    this.engine = engine;
    // Initialize engine asynchronously - don't block constructor
    this.initializeEngine().catch(err => {
      console.warn('Engine initialization warning:', err);
    });
  }

  private async initializeEngine(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!this.isReady) {
          console.log('  Engine initialization timeout, assuming ready');
          this.isReady = true;
          resolve();
        }
      }, 5000);
      
      this.engine.once('ready', () => {
        clearTimeout(timeout);
        this.isReady = true;
        resolve();
      });
    });
  }

  /**
   * Generate a single puzzle candidate
   */
  async generatePuzzle(options: {
    chess960Position?: number;
    getChess960Position: (n: number) => { fen: string; position: number };
    depth?: number;
    minMoves?: number;
    maxMoves?: number;
  }): Promise<PuzzleCandidate | null> {
    await this.initializeEngine();

    try {
      // Generate random Chess960 position
      const positionNum = options.chess960Position ?? 
        (Math.floor(Math.random() * 960) + 1);
      
      const chess960Pos = options.getChess960Position(positionNum);
      const chess = new Chess(chess960Pos.fen);

      // Use Stockfish to play both sides to create realistic positions
      // This ensures positions are more like real games
      const movesToPlay = (options.minMoves ?? 20) + 
        Math.floor(Math.random() * ((options.maxMoves ?? 40) - (options.minMoves ?? 20)));
      
      let movesPlayed = 0;
      // Use higher depth for better move quality - this is critical for realistic positions
      const quickDepth = 8; // Increased from 6 to 8 for better move quality
      const quickTimeout = 10000; // Increased from 5s to 10s per move for better analysis
      
      // Play moves using Stockfish (with some randomness for variety)
      for (let i = 0; i < movesToPlay && !chess.isGameOver() && movesPlayed < movesToPlay; i++) {
        try {
          // Analyze position to get best moves
          const moveAnalysis = await this.engine.analyzePosition(chess.fen(), {
            depth: quickDepth,
            multipv: 3, // Get top 3 moves
            time: quickTimeout,
          });
          
          if (!moveAnalysis.bestMove) {
            // Stockfish couldn't find a move - reject this position
            if (process.env.NODE_ENV === 'development') {
              console.log(`  Stockfish failed to find move at move ${movesPlayed}, rejecting position`);
            }
            return null;
          }
          
          // Choose from top moves with some randomness:
          // 70% chance to play best move, 20% second best, 10% third best
          // This creates realistic positions while adding variety
          const candidates = [
            moveAnalysis.bestMove,
            ...(moveAnalysis.alternativeMoves || []).slice(0, 2)
          ].filter(m => m && m.uci);
          
          if (candidates.length === 0) {
            // No valid candidates - reject position
            if (process.env.NODE_ENV === 'development') {
              console.log(`  No valid move candidates at move ${movesPlayed}, rejecting position`);
            }
            return null;
          }
          
          let chosenMove;
          const rand = Math.random();
          if (rand < 0.7 && candidates[0]) {
            chosenMove = candidates[0];
          } else if (rand < 0.9 && candidates[1]) {
            chosenMove = candidates[1];
          } else if (candidates[2]) {
            chosenMove = candidates[2];
          } else {
            chosenMove = candidates[0];
          }
          
          // Make the move
          const moveObj = chess.move({
            from: chosenMove.uci.slice(0, 2),
            to: chosenMove.uci.slice(2, 4),
            promotion: chosenMove.uci.length > 4 ? chosenMove.uci[4] : undefined,
          });
          
          if (!moveObj) {
            // Invalid move - reject position
            if (process.env.NODE_ENV === 'development') {
              console.log(`  Invalid move generated at move ${movesPlayed}, rejecting position`);
            }
            return null;
          }
          
          movesPlayed++;
          
          // Validate position periodically during generation (every 5 moves)
          // This catches unrealistic positions early
          if (movesPlayed % 5 === 0 && movesPlayed >= 10) {
            const currentFen = chess.fen();
            const tempValidation = validatePuzzlePosition(currentFen, 1500);
            if (!tempValidation.valid) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`  Position invalid during generation at move ${movesPlayed}: ${tempValidation.reason}`);
              }
              return null;
            }
          }
        } catch (error) {
          // If Stockfish analysis fails, reject the position instead of using random moves
          // Random moves create unrealistic positions with exposed kings
          if (process.env.NODE_ENV === 'development') {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.log(`  Stockfish error at move ${movesPlayed}: ${errorMsg}, rejecting position`);
          }
          return null;
        }
      }
      
      // Ensure we played enough moves
      if (movesPlayed < (options.minMoves ?? 20)) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`  Only played ${movesPlayed} moves, need at least ${options.minMoves ?? 20}, rejecting`);
        }
        return null;
      }

      // Skip if we're in a terminal position
      if (chess.isGameOver()) {
        return null;
      }
      
      // Validate position is realistic before proceeding
      const positionFen = chess.fen();
      const estimatedRating = 1500; // Will be refined later, but use for initial validation
      const validation = validatePuzzlePosition(positionFen, estimatedRating);
      if (!validation.valid) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Position rejected during generation: ${validation.reason}`);
        }
        return null;
      }

      // Analyze position with Stockfish for puzzle validation
      // Calculate timeout based on depth: depth 8 should take ~15-30 seconds
      const depth = options.depth ?? 12;
      
      // Analyze position with Stockfish (timeout is handled internally by engine)
      // Set timeout to be slightly longer than wrapper timeout for depth 9+
      const engineTimeout = depth >= 9 ? 50000 : 35000; // 50s for depth 9+, 35s otherwise
      const analysis = await this.engine.analyzePosition(positionFen, { 
        depth,
        multipv: 3,
        time: engineTimeout
      });

      // Check if this is a good puzzle position
      if (!analysis.bestMove || analysis.evaluation === undefined) {
        return null;
      }

      const bestMove = analysis.bestMove.uci;
      
      // Check if best move is tactical
      const tempChess = new Chess(positionFen);
      const moveObj = tempChess.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove.length > 4 ? bestMove[4] : undefined,
      });

      if (!moveObj) {
        return null;
      }

      // More lenient tactical criteria - accept more positions to speed up generation
      // Checkmate positions are always high-rated (2000+)
      const isTactical = 
        moveObj.captured || 
        tempChess.isCheck() || 
        tempChess.isCheckmate() ||
        Math.abs(analysis.evaluation) > 150; // Reduced from 200 to 150 - accept more positions

      if (!isTactical) {
        return null;
      }

      // Determine solution moves (best move + follow-up if check)
      const solutionMoves: string[] = [bestMove];
      
      if (tempChess.isCheck() && !tempChess.isCheckmate()) {
        // Try to find a follow-up move
        try {
          const followUpDepth = depth - 2;
          const followUpTimeout = followUpDepth >= 12 ? 60000 : 30000;
          const followUpAnalysis = await this.engine.analyzePosition(
            tempChess.fen(), 
            { depth: followUpDepth, time: followUpTimeout }
          );
          if (followUpAnalysis.bestMove) {
            solutionMoves.push(followUpAnalysis.bestMove.uci);
          }
        } catch (error) {
          // Continue without follow-up - log if it's not a timeout
          if (!(error instanceof Error && error.message.includes('timeout'))) {
            console.warn('Follow-up analysis error:', error);
          }
        }
      }

      // Calculate rating based on evaluation, complexity, and position characteristics
      // Consider material count, piece count, and tactical complexity for accurate rating
      let rating = 1500;
      const evalAbs = Math.abs(analysis.evaluation || 0);
      
      // Count pieces on board - fewer pieces generally means simpler positions
      const pieceCount = tempChess.board().flat().filter(p => p !== null).length;
      const isComplexPosition = pieceCount >= 20; // Most pieces still on board = more complex
      
      // Check if it's a simple winning position (huge material advantage)
      const isSimpleWin = evalAbs >= 600; // Very high eval = likely simple winning position
      
      if (tempChess.isCheckmate()) {
        // Checkmate positions - rate based on complexity
        if (isComplexPosition && solutionMoves.length >= 2) {
          rating = 2100 + Math.floor(Math.random() * 200); // 2100-2299 - complex checkmate
        } else {
          rating = 1800 + Math.floor(Math.random() * 200); // 1800-1999 - simpler checkmate
        }
      } else if (isSimpleWin) {
        // Simple winning positions (huge material advantage) should not be high-rated
        // Even if eval is high, if it's obvious, rate lower
        if (pieceCount <= 12) {
          // Endgame with huge advantage - easier
          rating = 1400 + Math.floor(Math.random() * 200); // 1400-1599
        } else {
          // Midgame with huge advantage - still easier than complex tactics
          rating = 1600 + Math.floor(Math.random() * 200); // 1600-1799
        }
      } else if (evalAbs >= 400 && isComplexPosition && solutionMoves.length >= 2) {
        // Complex tactical position with high evaluation - high-rated
        rating = 2000 + Math.floor(Math.random() * 200); // 2000-2199
      } else if (evalAbs >= 400) {
        // High eval but simpler position - medium-high rated
        rating = 1700 + Math.floor(Math.random() * 200); // 1700-1899
      } else if (moveObj.captured && evalAbs >= 250 && isComplexPosition) {
        // Winning material in complex position - high-rated
        rating = 1900 + Math.floor(Math.random() * 200); // 1900-2099
      } else if (moveObj.captured && evalAbs >= 250) {
        // Winning material in simpler position - medium-high rated
        rating = 1600 + Math.floor(Math.random() * 200); // 1600-1799
      } else if (moveObj.captured) {
        // Material capture - medium rated
        rating = 1400 + Math.floor(Math.random() * 400); // 1400-1799
      } else if (tempChess.isCheck() && evalAbs >= 250 && isComplexPosition) {
        // Check with significant advantage in complex position - medium-high rated
        rating = 1700 + Math.floor(Math.random() * 200); // 1700-1899
      } else if (tempChess.isCheck() && evalAbs >= 250) {
        // Check with advantage in simpler position - medium rated
        rating = 1500 + Math.floor(Math.random() * 200); // 1500-1699
      } else if (tempChess.isCheck()) {
        // Simple check - medium rated
        rating = 1300 + Math.floor(Math.random() * 300); // 1300-1599
      } else if (evalAbs >= 200 && isComplexPosition) {
        // Strong positional advantage in complex position - medium rated
        rating = 1500 + Math.floor(Math.random() * 200); // 1500-1699
      } else if (evalAbs >= 200) {
        // Strong positional advantage in simpler position - lower rated
        rating = 1300 + Math.floor(Math.random() * 200); // 1300-1499
      } else {
        // Other tactical positions - lower rated
        rating = 1200 + Math.floor(Math.random() * 200); // 1200-1399
      }
      
      // Final validation with calculated rating
      const finalValidation = validatePuzzlePosition(positionFen, rating);
      if (!finalValidation.valid) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Position rejected after rating calculation: ${finalValidation.reason} (rating: ${rating})`);
        }
        return null;
      }

      return {
        fen: positionFen,
        solution: bestMove,
        moves: solutionMoves,
        rating: Math.max(1200, Math.min(2500, rating)),
        evaluation: analysis.evaluation,
        initialFen: chess960Pos.fen,
        chess960Position: chess960Pos.position,
      };
    } catch (error) {
      // Log the error for debugging
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          console.warn(`Puzzle generation timeout for position ${options.chess960Position ?? 'random'}`);
        } else {
          console.warn('Error generating puzzle:', error.message);
        }
      } else {
        console.warn('Error generating puzzle:', error);
      }
      return null;
    }
  }

  /**
   * Generate multiple puzzles
   */
  async generatePuzzles(
    options: GeneratorOptions & {
      getChess960Position: (n: number) => { fen: string; position: number };
    }
  ): Promise<Puzzle[]> {
    const count = options.count ?? 50;
    const maxAttempts = count * 5; // Reduced from 10 to 5 for faster generation
    const puzzles: Puzzle[] = [];
    let attempts = 0;

    while (puzzles.length < count && attempts < maxAttempts) {
      attempts++;
      
      // Always log attempts for debugging
      console.log(`  [Attempt ${attempts}/${maxAttempts}] Trying to generate puzzle ${puzzles.length + 1}/${count}...`);
      
      try {
        // Add timeout wrapper for each puzzle generation - reduced to 45 seconds
        const startTime = Date.now();
        
        const puzzlePromise = this.generatePuzzle({
          chess960Position: options.chess960Position,
          getChess960Position: options.getChess960Position,
          depth: options.depth,
          minMoves: options.minMoves,
          maxMoves: options.maxMoves,
        });
        
        // Adjust timeout based on depth - deeper analysis needs more time
        const depth = options.depth ?? 7;
        const timeout = depth >= 9 ? 45000 : 30000; // 45s for depth 9+, 30s otherwise
        
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.warn(`  [Attempt ${attempts}] ⚠ TIMEOUT after ${elapsed}s - skipping`);
            resolve(null);
          }, timeout);
        });
        
        const candidate = await Promise.race([puzzlePromise, timeoutPromise]);
        
        const elapsedMs = Date.now() - startTime;
        const elapsed = (elapsedMs / 1000).toFixed(1);
        if (candidate) {
          console.log(`  [Attempt ${attempts}] ✓ Generated puzzle in ${elapsed}s`);
        } else if (elapsedMs < timeout) {
          console.log(`  [Attempt ${attempts}] ✗ No puzzle found (${elapsed}s)`);
        }

        // Small delay between attempts to prevent overwhelming Stockfish
        if (!candidate && attempts % 10 !== 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }

        if (candidate) {
          // Check if puzzle with this FEN already exists
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
            
            if (options.onProgress) {
              options.onProgress(puzzles.length, count, candidate);
            }
          }
        }
      } catch (error) {
        console.warn(`  Error in attempt ${attempts}:`, error instanceof Error ? error.message : error);
        // Continue to next attempt
      }
    }
    
    console.log(`\nGeneration complete: found ${puzzles.length} puzzles after ${attempts} attempts`);

    return puzzles;
  }
}

