import { db } from '@chess960/db';

async function testThemeQuery() {
  try {
    const themes = ['opening', 'endgame', 'mate', 'rookEndgame', 'checkmate'];
    
    for (const theme of themes) {
      console.log(`\n=== Testing theme: ${theme} ===`);
      
      const puzzles = await (db as any).puzzle.findMany({
        where: {
          themes: {
            has: theme,
          },
        },
        select: {
          id: true,
          themes: true,
          rating: true,
        },
        take: 5,
      });
      
      console.log(`Found ${puzzles.length} puzzles`);
      puzzles.forEach((p: any) => {
        console.log(`  - ${p.id}: themes=${JSON.stringify(p.themes)}, rating=${p.rating}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error testing theme query:', error);
    process.exit(1);
  }
}

testThemeQuery();

