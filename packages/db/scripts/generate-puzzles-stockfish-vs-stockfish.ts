import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { StockfishVsStockfishGenerator } from '@chess960/puzzle-generator';
import { deleteOldPuzzles } from './delete-old-puzzles';

/**
 * Generate puzzles by having Stockfish play against Stockfish with different skill levels.
 * This creates more realistic positions than random move generation.
 */
async function generatePuzzlesStockfishVsStockfish(count: number = 100) {
  try {
    console.log(`\n🎯 Generating ${count} puzzles using Stockfish vs Stockfish method...\n`);

    // Don't delete old puzzles - just add new ones
    // This way we don't lose existing puzzles if generation fails
    // console.log('🗑️  Deleting old puzzles...');
    // await deleteOldPuzzles();
    // console.log('✓ Old puzzles deleted\n');

    // Create two Stockfish engines (one stronger, one weaker)
    const engine1 = new StockfishEngine(); // Stronger (target rating)
    const engine2 = new StockfishEngine(); // Weaker (target rating - 50-100 points)
    
    const generator = new StockfishVsStockfishGenerator(engine1, engine2);

    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;

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
        console.log(`✓ Saved puzzle ${puzzlesCreated}/${count} - Rating: ${puzzleCandidate.rating} - Position: ${puzzleCandidate.chess960Position}`);
        return true;
      } catch (error) {
        console.error(`✗ Error saving puzzle:`, error);
        return false;
      }
    };

    // Generate target ratings: 1200, 1250, 1300, 1350, ..., up to 2000
    const targetRatings: number[] = [];
    for (let rating = 1200; rating <= 2000; rating += 50) {
      targetRatings.push(rating);
    }

    console.log(`📊 Target ratings: ${targetRatings.join(', ')}\n`);

    // Save puzzle with theme detection
    const savePuzzleWithThemes = async (puzzleCandidate: any): Promise<boolean> => {
      try {
        // Check if puzzle already exists with this FEN
        const existing = await (db as any).puzzle.findFirst({
          where: { fen: puzzleCandidate.fen },
        });

        if (existing) {
          puzzlesSkipped++;
          return false;
        }

        // Detect themes
        const { detectPuzzleThemes } = await import('../../../apps/web/src/lib/puzzle-theme-detector');
        const Chess = (await import('chess.js')).Chess;
        const chess = new Chess(puzzleCandidate.fen);
        const pieceCount = chess.board().flat().filter(p => p !== null).length;
        const isEndgame = pieceCount <= 12;
        
        const themesResult = detectPuzzleThemes(
          puzzleCandidate.fen,
          puzzleCandidate.moves || [puzzleCandidate.solution],
          puzzleCandidate.evaluation || 0,
          false
        );

        // Add endgame theme if it's an endgame position
        if (isEndgame && !themesResult.themes.includes('endgame')) {
          themesResult.themes.push('endgame');
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

        // Create puzzle with themes
        const puzzle = await (db as any).puzzle.create({
          data: {
            gameId: dummyGame.id,
            fen: puzzleCandidate.fen,
            solution: puzzleCandidate.solution,
            moves: puzzleCandidate.moves || [puzzleCandidate.solution],
            rating: puzzleCandidate.rating,
            plays: 0,
            votes: 0,
            themes: themesResult.themes,
          },
        });

        puzzlesCreated++;
        console.log(`✓ Saved puzzle ${puzzlesCreated}/${count} - Rating: ${puzzleCandidate.rating} - Themes: ${themesResult.themes.join(', ')}`);
        return true;
      } catch (error) {
        console.error(`✗ Error saving puzzle:`, error);
        return false;
      }
    };

    // Generate puzzles with longer games to get more endgame positions
    const puzzles = await generator.generatePuzzles({
      count,
      getChess960Position,
      targetRatings,
      minMoves: 50, // Increased significantly to reach endgame positions
      maxMoves: 80, // Increased significantly to reach endgame positions
      depth: 8, // Reduced depth for faster generation
      onProgress: async (current, total, puzzle) => {
        if (puzzle) {
          await savePuzzleWithThemes(puzzle);
        }
      },
    });

    console.log(`\n✅ Puzzle generation complete!`);
    console.log(`- Puzzles generated: ${puzzles.length}`);
    console.log(`- Puzzles saved to database: ${puzzlesCreated}`);
    console.log(`- Puzzles skipped (duplicates): ${puzzlesSkipped}`);
    
    // Clean up engines
    engine1.removeAllListeners();
    engine2.removeAllListeners();
    
  } catch (error) {
    console.error('Error generating puzzles:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Get count from command line or use default
const count = process.argv[2] ? parseInt(process.argv[2], 10) : 100;

if (isNaN(count) || count < 1) {
  console.error('Invalid count. Please provide a positive number.');
  process.exit(1);
}

// Run the generation
generatePuzzlesStockfishVsStockfish(count);



