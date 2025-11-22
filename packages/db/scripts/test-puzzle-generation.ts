import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess960PuzzleGenerator } from '@chess960/puzzle-generator';

/**
 * Test puzzle generation with detailed logging
 */
async function testPuzzleGeneration() {
  console.log('=== Testing Puzzle Generation ===\n');
  
  let engine: StockfishEngine | null = null;
  
  try {
    console.log('1. Initializing Stockfish engine...');
    engine = new StockfishEngine();
    
    const ready = await engine.isReady();
    if (!ready) {
      throw new Error('Engine failed to become ready');
    }
    console.log('✓ Engine ready\n');
    
    console.log('2. Creating puzzle generator...');
    const generator = new Chess960PuzzleGenerator(engine);
    console.log('✓ Generator created\n');
    
    console.log('3. Testing single puzzle generation (depth 8, faster for testing)...');
    const startTime = Date.now();
    
    const puzzle = await Promise.race([
      generator.generatePuzzle({
        getChess960Position,
        depth: 8, // Lower depth for faster testing
        minMoves: 10,
        maxMoves: 20,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => {
          console.error('⚠ Puzzle generation timed out after 180 seconds');
          resolve(null);
        }, 180000); // 3 minutes for depth 8
      }),
    ]);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (puzzle) {
      console.log(`✓ Puzzle generated in ${elapsed}s:`);
      console.log(`  Rating: ${puzzle.rating}`);
      console.log(`  Position: ${puzzle.chess960Position}`);
      console.log(`  FEN: ${puzzle.fen.substring(0, 50)}...`);
      console.log(`  Solution: ${puzzle.solution}`);
    } else {
      console.log(`✗ No puzzle generated (timeout or no valid position found)`);
    }
    
    console.log(`\n4. Testing database save...`);
    if (puzzle) {
      try {
        // Check if puzzle already exists
        const existing = await (db as any).puzzle.findFirst({
          where: { fen: puzzle.fen },
        });

        if (existing) {
          console.log('  Puzzle already exists in database, skipping save');
        } else {
          // Create dummy game
          const dummyGame = await db.game.create({
            data: {
              whiteId: null,
              blackId: null,
              tc: 'TWO_PLUS_ZERO' as any,
              rated: false,
              variant: 'CHESS960' as any,
              chess960Position: puzzle.chess960Position,
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
          const savedPuzzle = await (db as any).puzzle.create({
            data: {
              gameId: dummyGame.id,
              fen: puzzle.fen,
              solution: puzzle.solution,
              moves: puzzle.moves,
              rating: puzzle.rating,
              plays: 0,
              votes: 0,
            },
          });

          console.log(`✓ Puzzle saved to database: ${savedPuzzle.id}`);
        }
      } catch (error) {
        console.error('✗ Error saving puzzle:', error);
      }
    }
    
  } catch (error) {
    console.error('✗ Test failed:', error);
    if (error instanceof Error) {
      console.error('  Message:', error.message);
      console.error('  Stack:', error.stack);
    }
  } finally {
    if (engine) {
      console.log('\n5. Cleaning up engine...');
      engine.destroy();
      console.log('✓ Engine destroyed');
    }
    await db.$disconnect();
  }
}

testPuzzleGeneration();

