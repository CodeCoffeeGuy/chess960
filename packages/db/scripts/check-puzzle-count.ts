import { db } from '../src';

async function checkPuzzleCount() {
  try {
    const count = await (db as any).puzzle.count();
    console.log(`Current puzzles in database: ${count}`);
    
    // Get rating distribution
    const puzzles = await (db as any).puzzle.findMany({
      select: { rating: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    
    if (puzzles.length > 0) {
      const ratingGroups: Record<string, number> = {};
      puzzles.forEach((p: any) => {
        const group = Math.floor(p.rating / 50) * 50;
        ratingGroups[group] = (ratingGroups[group] || 0) + 1;
      });
      
      console.log('\nRecent puzzles by rating:');
      Object.entries(ratingGroups)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([rating, count]) => {
          console.log(`  ${rating}-${parseInt(rating) + 49}: ${count}`);
        });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkPuzzleCount();



