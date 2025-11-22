import { db } from '../src';

async function testDailyPuzzle() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Today (start):', today.toISOString());
    console.log('Tomorrow (end):', tomorrow.toISOString());
    console.log('');

    // Check all puzzles with day set
    const puzzlesWithDay = await (db as any).puzzle.findMany({
      where: { day: { not: null } },
      orderBy: { day: 'desc' },
      take: 5,
    });

    console.log(`Found ${puzzlesWithDay.length} puzzles with day set:`);
    puzzlesWithDay.forEach((p: any) => {
      console.log(`  - ID: ${p.id}, Day: ${p.day?.toISOString()}, Rating: ${p.rating}`);
    });
    console.log('');

    // Try to find puzzle for today
    const existingPuzzle = await (db as any).puzzle.findFirst({
      where: {
        day: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    console.log('Puzzle for today:', existingPuzzle ? `Found: ${existingPuzzle.id}` : 'Not found');
    
    if (existingPuzzle) {
      console.log(`  Day field: ${existingPuzzle.day?.toISOString()}`);
      console.log(`  Today query: ${today.toISOString()} to ${tomorrow.toISOString()}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

testDailyPuzzle();













