import { db } from '@chess960/db';

/**
 * Delete all existing puzzles from the database
 * This is useful when regenerating puzzles with a new method
 */
async function deleteOldPuzzles() {
  try {
    console.log('Deleting old puzzles...');
    
    // Delete puzzle rounds first (foreign key constraint)
    const roundsDeleted = await (db as any).puzzleRound.deleteMany({});
    console.log(`Deleted ${roundsDeleted.count} puzzle rounds`);
    
    // Delete puzzle theme votes
    const votesDeleted = await (db as any).puzzleThemeVote.deleteMany({});
    console.log(`Deleted ${votesDeleted.count} puzzle theme votes`);
    
    // Delete puzzles
    const puzzlesDeleted = await (db as any).puzzle.deleteMany({});
    console.log(`Deleted ${puzzlesDeleted.count} puzzles`);
    
    // Note: We don't delete the games as they might be referenced elsewhere
    // The dummy games will remain but that's okay
    
    console.log('✓ All old puzzles deleted successfully');
  } catch (error) {
    console.error('Error deleting old puzzles:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  deleteOldPuzzles()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

export { deleteOldPuzzles };

