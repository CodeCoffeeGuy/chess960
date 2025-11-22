import { db } from '@chess960/db';

async function checkPuzzleThemes() {
  try {
    console.log('Checking puzzle themes in database...\n');

    // Get total puzzle count
    const totalPuzzles = await (db as any).puzzle.count();
    console.log(`Total puzzles: ${totalPuzzles}`);

    // Get puzzles with themes
    const puzzlesWithThemes = await (db as any).puzzle.count({
      where: {
        themes: {
          isEmpty: false,
        },
      },
    });
    console.log(`Puzzles with themes: ${puzzlesWithThemes}`);
    console.log(`Puzzles without themes: ${totalPuzzles - puzzlesWithThemes}\n`);

    // Get all unique themes
    const allPuzzles = await (db as any).puzzle.findMany({
      select: {
        id: true,
        themes: true,
      },
    });

    const themeCounts: Record<string, number> = {};
    allPuzzles.forEach((puzzle: any) => {
      if (puzzle.themes && puzzle.themes.length > 0) {
        puzzle.themes.forEach((theme: string) => {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        });
      }
    });

    console.log('Theme distribution:');
    const sortedThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
    sortedThemes.forEach(([theme, count]) => {
      console.log(`  ${theme}: ${count} puzzles`);
    });

    console.log(`\nTotal unique themes: ${Object.keys(themeCounts).length}`);

    // Check which expected themes are missing
    const expectedThemes = [
      'tactics', 'endgame', 'opening', 'middlegame',
      'mate', 'mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5',
      'fork', 'pin', 'skewer', 'sacrifice', 'discoveredAttack', 'doubleCheck',
      'backRankMate', 'smotheredMate',
      'promotion', 'underPromotion', 'castling', 'enPassant',
      'hangingPiece', 'trappedPiece',
      'deflection', 'attraction', 'clearance', 'interference', 'xRayAttack', 'zugzwang',
      'advancedPawn',
      'rookEndgame', 'bishopEndgame', 'knightEndgame', 'pawnEndgame', 'queenEndgame',
    ];

    console.log('\nMissing themes (no puzzles):');
    const missingThemes = expectedThemes.filter(theme => !themeCounts[theme]);
    if (missingThemes.length > 0) {
      missingThemes.forEach(theme => {
        console.log(`  - ${theme}`);
      });
    } else {
      console.log('  All expected themes have puzzles!');
    }

    // Sample puzzles to see theme structure
    console.log('\nSample puzzles with themes:');
    const samplePuzzles = await (db as any).puzzle.findMany({
      where: {
        themes: {
          isEmpty: false,
        },
      },
      take: 5,
      select: {
        id: true,
        themes: true,
        rating: true,
      },
    });

    samplePuzzles.forEach((puzzle: any) => {
      console.log(`  Puzzle ${puzzle.id}: themes=${JSON.stringify(puzzle.themes)}, rating=${puzzle.rating}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error checking puzzle themes:', error);
    process.exit(1);
  }
}

checkPuzzleThemes();

