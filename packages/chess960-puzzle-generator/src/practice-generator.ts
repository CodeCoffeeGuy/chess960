import { Chess } from 'chess.js';
import type { StockfishEngine } from './types';

export type PracticeCategory = 'TACTICS' | 'ENDGAME' | 'STRATEGY' | 'CHECKMATE' | 'OPENING' | 'MIDDLEGAME';
export type PracticeDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface PracticeLessonCandidate {
  title: string;
  initialFen: string;
  instructions: string;
  solution: string; // PGN format
  hints: string[];
  category: PracticeCategory;
  difficulty: PracticeDifficulty;
  chess960Position?: number;
}

export interface PracticeGeneratorOptions {
  category: PracticeCategory;
  difficulty: PracticeDifficulty;
  chess960Position?: number;
  getChess960Position: (n: number) => { fen: string; position: number };
  depth?: number;
  minMoves?: number;
  maxMoves?: number;
}

/**
 * Practice Generator for Chess960
 * 
 * Generates practice lessons by:
 * 1. Starting from random Chess960 positions
 * 2. Playing Stockfish vs Stockfish to reach relevant positions
 * 3. Analyzing positions for educational value
 * 4. Creating lessons with solutions and hints
 */
export class PracticeGenerator {
  private engine: StockfishEngine;
  private isReady = false;

  constructor(engine: StockfishEngine) {
    this.engine = engine;
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
   * Generate a practice lesson based on category and difficulty
   * SIMPLIFIED: Use starting Chess960 position directly - no move playing
   */
  async generateLesson(options: PracticeGeneratorOptions): Promise<PracticeLessonCandidate | null> {
    await this.initializeEngine();

    try {
      // Generate random Chess960 position
      const positionNum = options.chess960Position ?? 
        (Math.floor(Math.random() * 960) + 1);
      
      const chess960Pos = options.getChess960Position(positionNum);
      const chess = new Chess(chess960Pos.fen);

      // Play some moves to get out of starting position
      const minMoves = options.minMoves ?? 5;
      const maxMoves = options.maxMoves ?? 15;
      const movesToPlay = minMoves + Math.floor(Math.random() * (maxMoves - minMoves));
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`    Playing ${movesToPlay} moves from Chess960 position ${positionNum}...`);
      }

      // Play moves to reach a more interesting position
      for (let i = 0; i < movesToPlay && !chess.isGameOver(); i++) {
        try {
          const moves = chess.moves();
          if (moves.length === 0) break;
          
          // Use Stockfish to find a good move (but fast)
          const moveAnalysis = await this.engine.analyzePosition(chess.fen(), {
            depth: 4, // Low depth for speed during game play
            multipv: 1,
            time: 2000, // 2 seconds max per move
          });

          if (moveAnalysis.bestMove && moveAnalysis.bestMove.uci) {
            const move = moveAnalysis.bestMove.uci;
            const from = move.slice(0, 2);
            const to = move.slice(2, 4);
            const promotion = move.length > 4 ? move[4] : undefined;
            chess.move({ from, to, promotion: promotion as any });
          } else {
            // Fallback to random move if Stockfish fails
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            chess.move(randomMove);
          }
        } catch (error) {
          // If analysis fails, just play a random move
          const moves = chess.moves();
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            chess.move(randomMove);
          }
        }
      }

      const finalFen = chess.fen();

      if (process.env.NODE_ENV === 'development') {
        console.log(`    Analyzing position after ${movesToPlay} moves (depth ${options.depth ?? 6})...`);
      }
      const analysis = await this.engine.analyzePosition(finalFen, {
        depth: options.depth ?? 6, // Use provided depth or default to 6
        multipv: 2, // Get top 2 moves for better analysis
        time: 5000, // 5 seconds max for final analysis
      });

      if (!analysis.bestMove || !analysis.bestMove.uci) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`    ✗ No best move found`);
        }
        return null;
      }

      // SIMPLIFIED: Always generate tactics lesson (fastest)
      const bestMove = analysis.bestMove.uci;
      const tempChess = new Chess(finalFen);
      
      const moveObj = tempChess.move({
        from: bestMove.slice(0, 2),
        to: bestMove.slice(2, 4),
        promotion: bestMove.length > 4 ? bestMove[4] : undefined,
      });

      if (!moveObj) {
        return null;
      }

      // Simple lesson - just the best move
      const solutionPgn = this.uciMovesToPgn([bestMove], finalFen);
      const hints = this.generateTacticsHints('tactical move', options.difficulty);

      return {
        title: 'Find the Best Move',
        initialFen: finalFen,
        instructions: `White to move. Find the best move in this Chess960 position.`,
        solution: solutionPgn,
        hints,
        category: options.category,
        difficulty: options.difficulty,
        chess960Position: chess960Pos.position,
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error generating practice lesson:', error);
      }
      return null;
    }
  }

  /**
   * Generate a tactics lesson (fork, pin, skewer, etc.)
   */
  private async generateTacticsLesson(
    chess: Chess,
    fen: string,
    analysis: any,
    chess960Pos: { fen: string; position: number },
    difficultyParams: any
  ): Promise<PracticeLessonCandidate | null> {
    const bestMove = analysis.bestMove.uci;
    const tempChess = new Chess(fen);
    
    const moveObj = tempChess.move({
      from: bestMove.slice(0, 2),
      to: bestMove.slice(2, 4),
      promotion: bestMove.length > 4 ? bestMove[4] : undefined,
    });

    if (!moveObj) {
      return null;
    }

    // Check if it's a tactical move
    const isTactical = moveObj.captured || tempChess.isCheck() || Math.abs(analysis.evaluation) > 150;
    
    if (!isTactical) {
      return null;
    }

    // Determine tactic type
    let tacticType = 'tactical move';
    let title = 'Find the Best Move';
    
    if (moveObj.captured) {
      if (Math.abs(analysis.evaluation) > 300) {
        tacticType = 'winning capture';
        title = 'Win Material';
      } else {
        tacticType = 'capture';
        title = 'Tactical Capture';
      }
    } else if (tempChess.isCheck()) {
      if (tempChess.isCheckmate()) {
        tacticType = 'checkmate';
        title = 'Find the Checkmate';
      } else {
        tacticType = 'check';
        title = 'Deliver Check';
      }
    }

    // Generate solution (best move + follow-up if needed)
    const solutionMoves: string[] = [bestMove];
    let solutionFen = tempChess.fen();

    // If check but not mate, try to find follow-up
    if (tempChess.isCheck() && !tempChess.isCheckmate()) {
        try {
          const followUpAnalysis = await this.engine.analyzePosition(solutionFen, {
            depth: 5, // Fixed low depth
            time: 2000, // 2 seconds max
          });
        if (followUpAnalysis.bestMove) {
          solutionMoves.push(followUpAnalysis.bestMove.uci);
        }
      } catch (error) {
        // Continue without follow-up
      }
    }

    // Convert solution to PGN
    const solutionPgn = this.uciMovesToPgn(solutionMoves, fen);

    // Generate hints based on tactic type
    const hints = this.generateTacticsHints(tacticType, difficultyParams.difficulty);

    return {
      title,
      initialFen: fen,
      instructions: `White to move. Find the ${tacticType}. ${this.getDifficultyInstruction(difficultyParams.difficulty)}`,
      solution: solutionPgn,
      hints,
      category: 'TACTICS',
      difficulty: difficultyParams.difficulty,
      chess960Position: chess960Pos.position,
    };
  }

  /**
   * Generate an endgame lesson
   */
  private async generateEndgameLesson(
    chess: Chess,
    fen: string,
    analysis: any,
    chess960Pos: { fen: string; position: number },
    difficultyParams: any
  ): Promise<PracticeLessonCandidate | null> {
    // Check if it's an endgame (fewer pieces)
    const pieceCount = chess.board().flat().filter(p => p !== null).length;
    
    if (pieceCount > 16) {
      // Not really an endgame, try to simplify
      return null;
    }

    const bestMove = analysis.bestMove.uci;
    const tempChess = new Chess(fen);
    
    const moveObj = tempChess.move({
      from: bestMove.slice(0, 2),
      to: bestMove.slice(2, 4),
      promotion: bestMove.length > 4 ? bestMove[4] : undefined,
    });

    if (!moveObj) {
      return null;
    }

    // Generate solution sequence
    const solutionMoves: string[] = [bestMove];
    let currentFen = tempChess.fen();
    
      // Try to find a winning sequence (up to 3 moves for speed)
      for (let i = 0; i < 2; i++) {
        try {
          const followUpAnalysis = await this.engine.analyzePosition(currentFen, {
            depth: 5, // Fixed low depth
            time: 2000, // 2 seconds max
          });
        
        if (!followUpAnalysis.bestMove) break;
        
        const followUpChess = new Chess(currentFen);
        const followUpMove = followUpAnalysis.bestMove.uci;
        const followUpMoveObj = followUpChess.move({
          from: followUpMove.slice(0, 2),
          to: followUpMove.slice(2, 4),
          promotion: followUpMove.length > 4 ? followUpMove[4] : undefined,
        });
        
        if (!followUpMoveObj) break;
        
        solutionMoves.push(followUpMove);
        currentFen = followUpChess.fen();
        
        if (followUpChess.isGameOver()) break;
      } catch (error) {
        break;
      }
    }

    const solutionPgn = this.uciMovesToPgn(solutionMoves, fen);
    const hints = this.generateEndgameHints(pieceCount, difficultyParams.difficulty);

    return {
      title: 'Endgame Technique',
      initialFen: fen,
      instructions: `White to move. Find the best endgame continuation. ${this.getDifficultyInstruction(difficultyParams.difficulty)}`,
      solution: solutionPgn,
      hints,
      category: 'ENDGAME',
      difficulty: difficultyParams.difficulty,
      chess960Position: chess960Pos.position,
    };
  }

  /**
   * Generate a checkmate lesson
   */
  private async generateCheckmateLesson(
    chess: Chess,
    fen: string,
    analysis: any,
    chess960Pos: { fen: string; position: number },
    difficultyParams: any
  ): Promise<PracticeLessonCandidate | null> {
    const bestMove = analysis.bestMove.uci;
    const tempChess = new Chess(fen);
    
    const moveObj = tempChess.move({
      from: bestMove.slice(0, 2),
      to: bestMove.slice(2, 4),
      promotion: bestMove.length > 4 ? bestMove[4] : undefined,
    });

    if (!moveObj) {
      return null;
    }

    // Check if it leads to checkmate
    if (!tempChess.isCheckmate()) {
      // Try to see if there's a mate in sequence
      let currentFen = tempChess.fen();
      const solutionMoves: string[] = [bestMove];
      
      for (let i = 0; i < 3; i++) { // Max 3 moves for speed
        try {
          const followUpAnalysis = await this.engine.analyzePosition(currentFen, {
            depth: 6, // Fixed depth
            time: 3000, // 3 seconds max
          });
          
          if (!followUpAnalysis.bestMove) break;
          
          const followUpChess = new Chess(currentFen);
          const followUpMove = followUpAnalysis.bestMove.uci;
          const followUpMoveObj = followUpChess.move({
            from: followUpMove.slice(0, 2),
            to: followUpMove.slice(2, 4),
            promotion: followUpMove.length > 4 ? followUpMove[4] : undefined,
          });
          
          if (!followUpMoveObj) break;
          
          solutionMoves.push(followUpMove);
          currentFen = followUpChess.fen();
          
          if (followUpChess.isCheckmate()) {
            const solutionPgn = this.uciMovesToPgn(solutionMoves, fen);
            const hints = this.generateCheckmateHints(solutionMoves.length, difficultyParams.difficulty);
            
            return {
              title: `Mate in ${solutionMoves.length}`,
              initialFen: fen,
              instructions: `White to move. Find checkmate in ${solutionMoves.length} move${solutionMoves.length > 1 ? 's' : ''}.`,
              solution: solutionPgn,
              hints,
              category: 'CHECKMATE',
              difficulty: difficultyParams.difficulty,
              chess960Position: chess960Pos.position,
            };
          }
        } catch (error) {
          break;
        }
      }
      
      return null; // No mate found
    }

    // Direct checkmate
    const solutionPgn = this.uciMovesToPgn([bestMove], fen);
    const hints = this.generateCheckmateHints(1, difficultyParams.difficulty);

    return {
      title: 'Checkmate in One',
      initialFen: fen,
      instructions: 'White to move. Find the checkmate in one move.',
      solution: solutionPgn,
      hints,
      category: 'CHECKMATE',
      difficulty: difficultyParams.difficulty,
      chess960Position: chess960Pos.position,
    };
  }

  /**
   * Generate a strategy lesson
   */
  private async generateStrategyLesson(
    chess: Chess,
    fen: string,
    analysis: any,
    chess960Pos: { fen: string; position: number },
    difficultyParams: any
  ): Promise<PracticeLessonCandidate | null> {
    const bestMove = analysis.bestMove.uci;
    
    // Strategy lessons focus on positional play, not just tactics
    const evalAbs = Math.abs(analysis.evaluation);
    
    if (evalAbs > 300) {
      // Too tactical, not strategic
      return null;
    }

    const solutionPgn = this.uciMovesToPgn([bestMove], fen);
    const hints = this.generateStrategyHints(difficultyParams.difficulty);

    return {
      title: 'Strategic Move',
      initialFen: fen,
      instructions: `White to move. Find the best strategic move. ${this.getDifficultyInstruction(difficultyParams.difficulty)}`,
      solution: solutionPgn,
      hints,
      category: 'STRATEGY',
      difficulty: difficultyParams.difficulty,
      chess960Position: chess960Pos.position,
    };
  }

  /**
   * Get difficulty parameters
   */
  private getDifficultyParams(difficulty: PracticeDifficulty) {
    // OPTIMIZED: Much faster parameters
    switch (difficulty) {
      case 'BEGINNER':
        return {
          depth: 5,
          minMoves: 3,
          maxMoves: 5,
          timeout: 2000,
          difficulty: 'BEGINNER' as PracticeDifficulty,
        };
      case 'INTERMEDIATE':
        return {
          depth: 6,
          minMoves: 4,
          maxMoves: 6,
          timeout: 3000,
          difficulty: 'INTERMEDIATE' as PracticeDifficulty,
        };
      case 'ADVANCED':
        return {
          depth: 7,
          minMoves: 5,
          maxMoves: 7,
          timeout: 4000,
          difficulty: 'ADVANCED' as PracticeDifficulty,
        };
      case 'EXPERT':
        return {
          depth: 8,
          minMoves: 6,
          maxMoves: 8,
          timeout: 5000,
          difficulty: 'EXPERT' as PracticeDifficulty,
        };
    }
  }

  /**
   * Convert UCI moves to PGN format
   */
  private uciMovesToPgn(moves: string[], initialFen: string): string {
    const chess = new Chess(initialFen);
    const pgnMoves: string[] = [];
    
    for (const uci of moves) {
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        
        const move = chess.move({ from, to, promotion: promotion as any });
        if (move) {
          pgnMoves.push(move.san);
        }
      } catch (error) {
        // Skip invalid moves
      }
    }
    
    return pgnMoves.join(' ');
  }

  /**
   * Generate hints for tactics lessons
   */
  private generateTacticsHints(tacticType: string, difficulty: PracticeDifficulty): string[] {
    const hints: string[] = [];
    
    if (difficulty === 'BEGINNER') {
      hints.push('Look for pieces that can attack multiple targets');
      hints.push('Check if you can capture an undefended piece');
      hints.push('Consider checks and threats');
    } else if (difficulty === 'INTERMEDIATE') {
      hints.push('Look for tactical patterns: forks, pins, or skewers');
      hints.push('Calculate the consequences of captures');
      hints.push('Check if the opponent has any weaknesses');
    } else {
      hints.push('Analyze all forcing moves');
      hints.push('Look for combinations and tactical sequences');
      hints.push('Consider the opponent\'s best responses');
    }
    
    return hints;
  }

  /**
   * Generate hints for endgame lessons
   */
  private generateEndgameHints(pieceCount: number, difficulty: PracticeDifficulty): string[] {
    const hints: string[] = [];
    
    if (difficulty === 'BEGINNER') {
      hints.push('Activate your king');
      hints.push('Try to promote your pawns');
      hints.push('Control key squares');
    } else {
      hints.push('Use opposition in king and pawn endgames');
      hints.push('Coordinate your pieces');
      hints.push('Calculate the endgame precisely');
    }
    
    return hints;
  }

  /**
   * Generate hints for checkmate lessons
   */
  private generateCheckmateHints(mateIn: number, difficulty: PracticeDifficulty): string[] {
    const hints: string[] = [];
    
    if (mateIn === 1) {
      hints.push('Look for a move that delivers checkmate');
      hints.push('Check all checks');
      hints.push('The king has no escape squares');
    } else {
      hints.push(`Find a forcing sequence leading to mate in ${mateIn} moves`);
      hints.push('Look for ways to restrict the king\'s mobility');
      hints.push('Coordinate your pieces for checkmate');
    }
    
    return hints;
  }

  /**
   * Generate hints for strategy lessons
   */
  private generateStrategyHints(difficulty: PracticeDifficulty): string[] {
    const hints: string[] = [];
    
    if (difficulty === 'BEGINNER') {
      hints.push('Improve your piece placement');
      hints.push('Control the center');
      hints.push('Develop your pieces');
    } else {
      hints.push('Look for positional improvements');
      hints.push('Consider pawn structure');
      hints.push('Plan for the long term');
    }
    
    return hints;
  }

  /**
   * Get difficulty-specific instruction
   */
  private getDifficultyInstruction(difficulty: PracticeDifficulty): string {
    switch (difficulty) {
      case 'BEGINNER':
        return 'This is a beginner-level position. Look for the most obvious improvement.';
      case 'INTERMEDIATE':
        return 'This position requires some calculation. Find the best continuation.';
      case 'ADVANCED':
        return 'This is an advanced position. Calculate carefully to find the best move.';
      case 'EXPERT':
        return 'This is an expert-level position. Deep calculation is required.';
    }
  }
}

