import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { Chess960PuzzleGenerator } from '@chess960/puzzle-generator';

/**
 * Generate high-rated (2000+) Chess960 puzzles using deeper Stockfish analysis.
 * This script specifically targets advanced puzzles for experienced players.
 */
async function generateHighRatedPuzzles(targetCount: number = 100) {
  try {
    console.log(`\n🎯 Generating ${targetCount} high-rated (2000+) Chess960 puzzles...`);
    console.log(`Using deeper analysis (depth 10) for better puzzle quality\n`);
    
    const engine = new StockfishEngine();
    const generator = new Chess960PuzzleGenerator(engine);

    let puzzlesCreated = 0;
    let puzzlesSkipped = 0;
    let puzzlesGenerated = 0;
    let attempts = 0;
    const maxAttempts = targetCount * 15; // Try more attempts for high-rated puzzles

    // Save puzzle to database
    const savePuzzle = async (puzzleCandidate: any): Promise<boolean> => {
      try {
        // Only save if rating is 2000+
        if (puzzleCandidate.rating < 2000) {
          return false;
        }

        // Check if puzzle already exists with this FEN
        const existing = await (db as any).puzzle.findFirst({
          where: { fen: puzzleCandidate.fen },
        });

        if (existing) {
          puzzlesSkipped++;
          return false;
        }

        // Create a dummy game record for the puzzle
        const dummyGame = await db.game.create({
          data: {
            whiteId: null,
            blackId: null,
            tc: 'TWO_PLUS_ZERO' as any,
            rated: false,
            variant: 'CHESS960' as any,
            chess960Position: puzzleCandidate.chess960Position,
            startedAt: new Date(),
            endedAt: new Date(),
            result: 'draw',
            whiteTimeMs: 120000,
            blackTimeMs: 120000,
            whiteIncMs: 0,
            blackIncMs: 0,
          },
        });

        // Create puzzle
        const puzzle = await (db as any).puzzle.create({
          data: {
            gameId: dummyGame.id,
            fen: puzzleCandidate.fen,
            solution: puzzleCandidate.solution,
            moves: puzzleCandidate.moves,
            rating: puzzleCandidate.rating,
            plays: 0,
            votes: 0,
          },
        });

        puzzlesCreated++;
        console.log(`✓ Saved high-rated puzzle ${puzzlesCreated}/${targetCount} - ID: ${puzzle.id} - Rating: ${puzzleCandidate.rating}`);
        return true;
      } catch (error) {
        console.error(`✗ Error saving puzzle:`, error);
        return false;
      }
    };

    // Generate puzzles in groups of 20
    const groupSize = 20; // Find 20 puzzles per group
    const totalGroups = Math.ceil(targetCount / groupSize);
    
    for (let group = 1; group <= totalGroups && puzzlesCreated < targetCount; group++) {
      const remaining = targetCount - puzzlesCreated;
      const currentGroupTarget = Math.min(groupSize, remaining);
      
      console.log(`\n🎯 GROUP ${group}/${totalGroups}: Finding ${currentGroupTarget} high-rated puzzles...`);
      console.log(`   Overall progress: ${puzzlesCreated}/${targetCount} puzzles found`);
      
      let groupPuzzlesFound = 0;
      const groupMaxAttempts = currentGroupTarget * 20; // Try up to 20 attempts per puzzle
      let groupAttempts = 0;
      
      // Generate puzzles until we find enough for this group
      while (groupPuzzlesFound < currentGroupTarget && groupAttempts < groupMaxAttempts) {
        const batchSize = 10; // Generate in batches of 10
        const remainingInGroup = currentGroupTarget - groupPuzzlesFound;
        
        console.log(`\n   📦 Generating batch (need ${remainingInGroup} more for this group)...`);
        
        const puzzles = await generator.generatePuzzles({
          count: Math.min(batchSize, remainingInGroup * 2), // Generate more candidates than needed
          getChess960Position,
          depth: 9, // Balanced depth for reliability and quality
          minMoves: 12, // Balanced moves for tactical positions
          maxMoves: 30, // Balanced moves for complex positions
          onProgress: async (current, total, puzzle) => {
            attempts++;
            groupAttempts++;
            if (puzzle) {
              if (puzzle.rating >= 2000) {
                puzzlesGenerated++;
                console.log(`   🎯 Found high-rated puzzle ${puzzlesGenerated} - Rating: ${puzzle.rating} - Position: ${puzzle.chess960Position}`);
                // Save immediately if it's high-rated
                const saved = await savePuzzle(puzzle);
                if (saved) {
                  groupPuzzlesFound++;
                  console.log(`   ✅ Group progress: ${groupPuzzlesFound}/${currentGroupTarget} found`);
                }
                
                // Stop if we've reached group target
                if (groupPuzzlesFound >= currentGroupTarget) {
                  console.log(`\n   ✅ GROUP ${group} COMPLETE! Found ${groupPuzzlesFound} puzzles`);
                  return;
                }
                
                // Stop if we've reached overall target
                if (puzzlesCreated >= targetCount) {
                  console.log(`\n✅ Reached overall target of ${targetCount} high-rated puzzles!`);
                  return;
                }
              } else {
                // Log lower-rated puzzles for reference
                if (groupAttempts % 50 === 0) {
                  console.log(`   Attempt ${groupAttempts}: Found puzzle with rating ${puzzle.rating} (need 2000+)`);
                }
              }
            }
          },
        });
        
        // If we haven't found enough, continue to next batch
        if (groupPuzzlesFound < currentGroupTarget && puzzlesCreated < targetCount) {
          console.log(`   ⏳ Found ${groupPuzzlesFound}/${currentGroupTarget} for this group, continuing...`);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Small delay between batches
        }
      }
      
      // Summary for this group
      if (groupPuzzlesFound >= currentGroupTarget) {
        console.log(`\n✅ GROUP ${group} COMPLETE! Found ${groupPuzzlesFound} high-rated puzzles`);
        console.log(`   Overall: ${puzzlesCreated}/${targetCount} puzzles found`);
      } else {
        console.log(`\n⚠️  GROUP ${group} PARTIAL: Found ${groupPuzzlesFound}/${currentGroupTarget} puzzles after ${groupAttempts} attempts`);
      }
      
      // Pause between groups (except for the last one)
      if (group < totalGroups && puzzlesCreated < targetCount) {
        console.log(`\n⏸️  Pausing 10 seconds before starting next group...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      // Stop if we've reached overall target
      if (puzzlesCreated >= targetCount) {
        break;
      }
    }

    console.log(`\n✅ High-rated puzzle generation complete!`);
    console.log(`- Puzzles generated (2000+): ${puzzlesGenerated}`);
    console.log(`- Puzzles saved to database: ${puzzlesCreated}`);
    console.log(`- Puzzles skipped (duplicates): ${puzzlesSkipped}`);
    console.log(`- Total attempts: ${attempts}`);
    console.log(`- Target: ${targetCount}, Achieved: ${puzzlesCreated}`);
    
    // Clean up engine
    engine.removeAllListeners();
    
  } catch (error) {
    console.error('Error generating high-rated puzzles:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Get count from command line or use default
const count = process.argv[2] ? parseInt(process.argv[2], 10) : 100;

if (isNaN(count) || count < 1) {
  console.error('Invalid count. Please provide a positive number.');
  process.exit(1);
}

// Run the generation
generateHighRatedPuzzles(count);

