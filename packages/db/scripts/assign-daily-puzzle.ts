import { db } from '../src';
import { getDailyPuzzle } from '../../../apps/web/src/lib/daily-puzzle-service';

/**
 * Manually assign today's daily puzzle.
 * This will select a puzzle from the database and mark it as today's daily puzzle.
 */
async function assignDailyPuzzle() {
  try {
    console.log('Assigning today\'s daily puzzle...\n');
    
    // Clear cache first to force fresh selection
    const { clearDailyPuzzleCache } = await import('../../../apps/web/src/lib/daily-puzzle-service');
    clearDailyPuzzleCache();
    
    const puzzle = await getDailyPuzzle();
    
    if (puzzle) {
      console.log('✅ Daily puzzle assigned successfully!');
      console.log(`   Puzzle ID: ${puzzle.id}`);
      console.log(`   Rating: ${puzzle.rating}`);
      console.log(`   FEN: ${puzzle.fen}`);
      console.log(`   Solution: ${puzzle.solution}`);
    } else {
      console.log('❌ Failed to assign daily puzzle. Possible reasons:');
      console.log('   - No puzzles available in database');
      console.log('   - No puzzles with rating between 1500-2500');
      console.log('   - All puzzles have already been used');
    }
  } catch (error) {
    console.error('Error assigning daily puzzle:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

assignDailyPuzzle();

