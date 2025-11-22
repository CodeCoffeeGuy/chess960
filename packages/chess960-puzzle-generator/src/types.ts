/**
 * Types for Chess960 puzzle generation
 */

export interface Puzzle {
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
  initialFen?: string;
  chess960Position?: number;
}

export interface PuzzleCandidate {
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
  evaluation: number;
  initialFen?: string;
  chess960Position?: number;
}

export interface GeneratorOptions {
  /**
   * Number of puzzles to generate
   */
  count?: number;
  
  /**
   * Stockfish analysis depth (default: 12)
   */
  depth?: number;
  
  /**
   * Minimum moves to play before analyzing (default: 15)
   */
  minMoves?: number;
  
  /**
   * Maximum moves to play before analyzing (default: 30)
   */
  maxMoves?: number;
  
  /**
   * Minimum puzzle rating (default: 1200)
   */
  minRating?: number;
  
  /**
   * Maximum puzzle rating (default: 2500)
   */
  maxRating?: number;
  
  /**
   * Callback for progress updates
   */
  onProgress?: (current: number, total: number, puzzle?: PuzzleCandidate) => void;
  
  /**
   * Specific Chess960 position number (1-960), or random if not provided
   */
  chess960Position?: number;
}

export interface StockfishEngine {
  analyzePosition(fen: string, options?: { depth?: number; multipv?: number; time?: number }): Promise<{
    bestMove: { uci: string; san?: string; evaluation?: number; depth?: number; pv?: string[]; mate?: number };
    alternativeMoves?: Array<{ uci: string; san?: string; evaluation?: number; depth?: number; pv?: string[]; mate?: number }>;
    evaluation: number;
    depth: number;
    time?: number;
    nodes?: number;
  }>;
  once(event: 'ready', callback: () => void): void;
  removeAllListeners(): void;
  setSkillLevel?(level: number): Promise<void>;
}

