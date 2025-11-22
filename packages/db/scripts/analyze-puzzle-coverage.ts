import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function analyzeCoverage() {
  try {
    const stats = await db.$queryRaw<Array<{ rating_range: string; count: bigint }>>`
      SELECT 
        CASE 
          WHEN rating < 1200 THEN 'Under 1200'
          WHEN rating < 1300 THEN '1200-1299'
          WHEN rating < 1400 THEN '1300-1399'
          WHEN rating < 1500 THEN '1400-1499'
          WHEN rating < 1600 THEN '1500-1599'
          WHEN rating < 1700 THEN '1700-1799'
          WHEN rating < 1800 THEN '1800-1899'
          WHEN rating < 1900 THEN '1900-1999'
          WHEN rating < 2000 THEN '2000-2099'
          WHEN rating < 2100 THEN '2100-2199'
          WHEN rating < 2200 THEN '2200-2299'
          WHEN rating < 2300 THEN '2300-2399'
          WHEN rating < 2400 THEN '2400-2499'
          WHEN rating < 2500 THEN '2500-2499'
          ELSE '2500+'
        END as rating_range,
        COUNT(*) as count
      FROM puzzles
      GROUP BY rating_range
      ORDER BY MIN(rating);
    `;

    console.log('\n=== Detailed Rating Distribution ===');
    stats.forEach((s) => {
      const count = Number(s.count);
      console.log(`  ${s.rating_range.padEnd(15)}: ${count.toString().padStart(4)} puzzles`);
    });

    const total = await db.puzzle.count();
    console.log(`\nTotal: ${total} puzzles`);

    // Calculate coverage
    const daysCoverage = Math.floor(total / 1); // 1 puzzle per day
    const monthsCoverage = Math.floor(daysCoverage / 30);
    const yearsCoverage = Math.floor(daysCoverage / 365);
    console.log(`\nCoverage: ~${daysCoverage} days (~${monthsCoverage} months, ~${yearsCoverage} years) of daily puzzles`);

    // Recommendations
    console.log('\n=== Recommendations ===');
    if (total < 365) {
      console.log(`  ⚠ Need at least 365 puzzles for a full year of daily puzzles`);
      console.log(`  → Generate ${365 - total} more puzzles`);
    } else {
      console.log(`  ✓ Have enough for ${yearsCoverage}+ year(s) of daily puzzles`);
    }

    if (total < 1000) {
      console.log(`  💡 Consider generating 1000+ puzzles for better variety:`);
      console.log(`     - Multiple puzzles per rating band`);
      console.log(`     - Better user experience (users solve multiple puzzles)`);
      console.log(`     - Progressive difficulty within same rating range`);
    }

    if (total < 2000) {
      console.log(`  🎯 Ideal: 2000-3000 puzzles for production-ready experience`);
      console.log(`     - Similar to Lichess's approach`);
      console.log(`     - Excellent variety and user engagement`);
    }

    // Check high-rated puzzle coverage
    const highRated = await db.puzzle.count({
      where: { rating: { gte: 2000 } }
    });
    if (highRated < 50) {
      console.log(`\n  ⚠ Only ${highRated} high-rated puzzles (2000+)`);
      console.log(`     Consider generating more for advanced users`);
    }

  } catch (error) {
    console.error('Error analyzing coverage:', error);
  } finally {
    await db.$disconnect();
  }
}

analyzeCoverage();














