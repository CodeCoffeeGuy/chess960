import { db } from '../src';
import { extractPuzzleFromGame, createPuzzleFromCandidate } from '../../../apps/web/src/lib/puzzle-extractor';
import { extractPuzzleFromGameWithStockfish, createPuzzleFromCandidate as createPuzzleWithThemes } from '../../../apps/web/src/lib/puzzle-extractor-improved';
import { StockfishEngine } from '@chess960/stockfish';

/**
 * Extract puzzles from completed games in the database.
 * This script analyzes finished games and creates puzzle candidates.
 */
async function extractPuzzles() {
  try {
    console.log('Starting puzzle extraction from completed games with Stockfish validation...');
    console.log('This will use Stockfish to validate puzzles for better quality.\n');

    // Initialize Stockfish engine
    const engine = new StockfishEngine();
    await engine.isReady();
    console.log('Stockfish engine ready\n');

    // Get completed games with moves - filter for quality games
    const completedGames = await db.game.findMany({
      where: {
        endedAt: { not: null },
        result: { not: null, not: 'abort' },
        // Only use games where both players had reasonable ratings
        whiteRatingBefore: { gte: 1200 },
        blackRatingBefore: { gte: 1200 },
      },
      include: {
        moves: {
          orderBy: { ply: 'asc' },
          select: { uci: true },
        },
      },
      take: 200, // Analyze more games to find good puzzles
    });
    
    // Sort by number of moves (longer games = better quality)
    completedGames.sort((a, b) => (b.moves?.length || 0) - (a.moves?.length || 0));

    console.log(`Found ${completedGames.length} completed games to analyze\n`);

    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;
    let puzzlesFailed = 0;

    for (const game of completedGames) {
      // Skip games with too few moves
      if (!game.moves || game.moves.length < 10) {
        continue;
      }

      try {
        // Extract puzzle candidate with Stockfish validation
        const candidate = await extractPuzzleFromGameWithStockfish(game.id, engine);

        if (candidate) {
          // Check if puzzle already exists for this game
          const existing = await (db as any).puzzle.findFirst({
            where: {
              gameId: game.id,
              fen: candidate.fen,
            },
          });

          if (!existing) {
            // Create the puzzle with themes
            const puzzleId = await createPuzzleWithThemes(candidate);
            if (puzzleId) {
              puzzlesCreated++;
              console.log(`✓ Created puzzle ${puzzleId} from game ${game.id} (themes: ${candidate.themes?.join(', ') || 'none'})`);
            }
          } else {
            puzzlesSkipped++;
          }
        } else {
          puzzlesFailed++;
        }
      } catch (error) {
        console.error(`✗ Error processing game ${game.id}:`, error);
        puzzlesFailed++;
        continue;
      }
    }

    // Cleanup
    engine.destroy();

    console.log(`\n✓ Puzzle extraction complete!`);
    console.log(`- Puzzles created: ${puzzlesCreated}`);
    console.log(`- Puzzles skipped (duplicates): ${puzzlesSkipped}`);
    console.log(`- Puzzles failed validation: ${puzzlesFailed}`);
    console.log(`- Games processed: ${completedGames.length}`);
  } catch (error) {
    console.error('Error extracting puzzles:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the extraction
extractPuzzles();

