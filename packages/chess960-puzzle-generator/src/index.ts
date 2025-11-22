/**
 * @chess960/puzzle-generator
 * 
 * Generate Chess960 tactical puzzles using Stockfish engine analysis.
 * 
 * This package provides tools to generate high-quality Chess960 puzzles
 * by analyzing random positions with Stockfish and identifying tactical opportunities.
 */

export { Chess960PuzzleGenerator } from './generator';
export { StockfishVsStockfishGenerator } from './stockfish-vs-stockfish-generator';
export { PracticeGenerator } from './practice-generator';
export { QualityPracticeGenerator } from './quality-practice-generator';
export { validatePuzzlePosition } from './position-validator';
export type { Puzzle, PuzzleCandidate, GeneratorOptions, StockfishEngine } from './types';
export type { PracticeLessonCandidate, PracticeCategory, PracticeDifficulty, PracticeGeneratorOptions } from './practice-generator';
export type { QualityPracticeLesson, PracticeGoal, GenerationOptions } from './quality-practice-generator';












