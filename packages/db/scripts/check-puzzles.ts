import { db } from '../src';

async function checkPuzzles() {
  try {
    // Validate DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || dbUrl === '...' || dbUrl.trim() === '...' || (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://'))) {
      console.error('\n❌ Error: DATABASE_URL is not set or invalid.');
      console.error('\nYou used: DATABASE_URL="..." which is just a placeholder.');
      console.error('\nPlease use your actual database URL:');
      console.error('export DATABASE_URL="postgresql://neondb_owner:npg_PDarGg6v3bfn@ep-ancient-heart-a2lqb2ul-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"');
      console.error('\nOr check your .env file if you have one configured.\n');
      process.exit(1);
    }

    const count = await (db as any).puzzle.count();
    const ratingDistribution = await (db as any).puzzle.groupBy({
      by: ['rating'],
      _count: {
        rating: true,
      },
      orderBy: {
        rating: 'asc',
      },
    });

    console.log(`\n=== Puzzle Database Status ===`);
    console.log(`Total puzzles: ${count}`);
    console.log(`\nRating distribution:`);
    
    const ranges = [
      { min: 0, max: 1300, label: '1200-1300' },
      { min: 1300, max: 1500, label: '1300-1500' },
      { min: 1500, max: 1800, label: '1500-1800' },
      { min: 1800, max: 2100, label: '1800-2100' },
      { min: 2100, max: 2500, label: '2100-2500' },
    ];

    for (const range of ranges) {
      const inRange = await (db as any).puzzle.count({
        where: {
          rating: {
            gte: range.min,
            lt: range.max,
          },
        },
      });
      if (inRange > 0) {
        console.log(`  ${range.label}: ${inRange}`);
      }
    }

    const dailyPuzzle = await (db as any).puzzle.findFirst({
      where: {
        day: { not: null },
      },
      orderBy: {
        day: 'desc',
      },
    });

    if (dailyPuzzle) {
      console.log(`\nCurrent daily puzzle:`);
      console.log(`  ID: ${dailyPuzzle.id}`);
      console.log(`  Rating: ${dailyPuzzle.rating}`);
      console.log(`  Day: ${dailyPuzzle.day}`);
    } else {
      console.log(`\nNo daily puzzle assigned yet`);
    }

  } catch (error) {
    console.error('Error checking puzzles:', error);
  } finally {
    await db.$disconnect();
  }
}

checkPuzzles();

