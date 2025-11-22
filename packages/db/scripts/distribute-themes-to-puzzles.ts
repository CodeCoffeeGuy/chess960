import { db } from '@chess960/db';

// Distribute themes across puzzles so each theme has at least some puzzles
async function distributeThemes() {
  try {
    console.log('Distributing themes across puzzles...\n');
    
    const allThemes = [
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
    
    // Get all puzzles
    const puzzles = await (db as any).puzzle.findMany({
      select: {
        id: true,
        themes: true,
      },
    });
    
    console.log(`Found ${puzzles.length} puzzles\n`);
    
    // Distribute themes - each puzzle gets 2-4 random themes
    // This ensures variety and that most themes have at least some puzzles
    let updated = 0;
    
    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i];
      
      // Keep existing themes, add 1-2 more random themes
      const existingThemes = puzzle.themes || [];
      const availableThemes = allThemes.filter(t => !existingThemes.includes(t));
      
      // Add 1-2 random themes
      const numNewThemes = Math.floor(Math.random() * 2) + 1; // 1 or 2
      const shuffled = [...availableThemes].sort(() => Math.random() - 0.5);
      const newThemes = shuffled.slice(0, numNewThemes);
      
      const allThemesForPuzzle = [...new Set([...existingThemes, ...newThemes])];
      
      await (db as any).puzzle.update({
        where: { id: puzzle.id },
        data: { themes: allThemesForPuzzle },
      });
      
      updated++;
      if (updated % 10 === 0) {
        console.log(`Updated ${updated}/${puzzles.length} puzzles...`);
      }
    }
    
    console.log(`\n✅ Completed! Updated ${updated} puzzles\n`);
    
    // Verify distribution
    const allPuzzles = await (db as any).puzzle.findMany({
      select: { themes: true },
    });
    
    const themeCounts: Record<string, number> = {};
    allPuzzles.forEach((p: any) => {
      if (p.themes && p.themes.length > 0) {
        p.themes.forEach((theme: string) => {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        });
      }
    });
    
    console.log('Theme distribution after update:');
    const sorted = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([theme, count]) => {
      console.log(`  ${theme}: ${count} puzzles`);
    });
    
    console.log(`\nTotal unique themes: ${Object.keys(themeCounts).length}`);
    
    const missing = allThemes.filter(t => !themeCounts[t]);
    if (missing.length > 0) {
      console.log(`\nStill missing themes: ${missing.length}`);
      console.log(`  ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`);
    } else {
      console.log('\n✅ All themes have at least one puzzle!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error distributing themes:', error);
    process.exit(1);
  }
}

distributeThemes();

