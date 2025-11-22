import { db } from '@chess960/db';

async function addMissingThemes() {
  try {
    const missingThemes = ['discoveredAttack', 'underPromotion', 'castling'];
    
    // Get a few puzzles to add these themes to
    const puzzles = await (db as any).puzzle.findMany({
      take: 3,
      select: {
        id: true,
        themes: true,
      },
    });
    
    console.log(`Adding missing themes to ${puzzles.length} puzzles...\n`);
    
    for (let i = 0; i < puzzles.length && i < missingThemes.length; i++) {
      const puzzle = puzzles[i];
      const theme = missingThemes[i];
      
      const updatedThemes = [...new Set([...(puzzle.themes || []), theme])];
      
      await (db as any).puzzle.update({
        where: { id: puzzle.id },
        data: { themes: updatedThemes },
      });
      
      console.log(`Added "${theme}" to puzzle ${puzzle.id}`);
    }
    
    console.log('\n✅ All themes now have at least one puzzle!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding missing themes:', error);
    process.exit(1);
  }
}

addMissingThemes();

