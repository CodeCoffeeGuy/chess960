import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess960PuzzleGenerator } from '@chess960/puzzle-generator';

/**
 * Generate Chess960 puzzles using Stockfish analysis.
 * Uses the @chess960/puzzle-generator package for clean, reusable puzzle generation.
 */
async function generateChess960Puzzles(count: number = 50) {
  try {
    console.log(`Generating ${count} Chess960 puzzles using Stockfish...`);
    
    const engine = new StockfishEngine();
    const generator = new Chess960PuzzleGenerator(engine);

    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;
    let puzzlesGenerated = 0;

    // Save puzzle to database
    const savePuzzle = async (puzzleCandidate: any): Promise<boolean> => {
      try {
        // Check if puzzle already exists with this FEN
        const existing = await (db as any).puzzle.findFirst({
          where: { fen: puzzleCandidate.fen },
        });

        if (existing) {
          puzzlesSkipped++;
          return false;
        }

        // Create a dummy game record for the puzzle
        const dummyGame = await db.game.create({
          data: {
            whiteId: null,
            blackId: null,
            tc: 'TWO_PLUS_ZERO' as any,
            rated: false,
            variant: 'CHESS960' as any,
            chess960Position: puzzleCandidate.chess960Position,
            startedAt: new Date(),
            endedAt: new Date(),
            result: 'draw',
            whiteTimeMs: 120000,
            blackTimeMs: 120000,
            whiteIncMs: 0,
            blackIncMs: 0,
          },
        });

        // Create puzzle
        const puzzle = await (db as any).puzzle.create({
          data: {
            gameId: dummyGame.id,
            fen: puzzleCandidate.fen,
            solution: puzzleCandidate.solution,
            moves: puzzleCandidate.moves,
            rating: puzzleCandidate.rating,
            plays: 0,
            votes: 0,
          },
        });

        puzzlesCreated++;
        console.log(`✓ Saved puzzle ${puzzlesCreated}/${count} - ID: ${puzzle.id} - Rating: ${puzzleCandidate.rating}`);
        return true;
      } catch (error) {
        console.error(`✗ Error saving puzzle:`, error);
        return false;
      }
    };

    // Generate in smaller batches to avoid overwhelming Stockfish
    const batchSize = 20; // Generate 20 puzzles at a time
    const batches = Math.ceil(count / batchSize);
    
    for (let batch = 1; batch <= batches; batch++) {
      const remaining = count - puzzlesCreated;
      const batchCount = Math.min(batchSize, remaining);
      
      if (batchCount <= 0) break;
      
      console.log(`\n📦 Batch ${batch}/${batches}: Generating ${batchCount} puzzles...`);
      
      const puzzles = await generator.generatePuzzles({
        count: batchCount,
        getChess960Position,
        depth: 7, // Further reduced for more reliable generation
        minMoves: 8, // Reduced moves for faster generation
        maxMoves: 20, // Reduced moves for faster generation
        onProgress: async (current, total, puzzle) => {
          if (puzzle) {
            puzzlesGenerated++;
            console.log(`Generated ${current}/${total} - Rating: ${puzzle.rating} - Position: ${puzzle.chess960Position}`);
            // Save immediately as puzzle is generated
            await savePuzzle(puzzle);
          }
        },
      });
      
      // Small delay between batches to let Stockfish recover
      if (batch < batches) {
        console.log(`\n⏸️  Pausing 5 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`\n✅ Puzzle generation complete!`);
    console.log(`- Puzzles generated: ${puzzlesGenerated}`);
    console.log(`- Puzzles saved to database: ${puzzlesCreated}`);
    console.log(`- Puzzles skipped (duplicates): ${puzzlesSkipped}`);
    
    // Clean up engine
    engine.removeAllListeners();
    
  } catch (error) {
    console.error('Error generating puzzles:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Get count from command line or use default
const count = process.argv[2] ? parseInt(process.argv[2], 10) : 50;

if (isNaN(count) || count < 1) {
  console.error('Invalid count. Please provide a positive number.');
  process.exit(1);
}

// Run the generation
generateChess960Puzzles(count);
