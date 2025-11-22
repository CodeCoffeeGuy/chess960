import { db } from '../src';
import { getChess960Position } from '@chess960/utils';
import { StockfishEngine } from '@chess960/stockfish';
import { PracticeGenerator, type PracticeCategory, type PracticeDifficulty } from '@chess960/puzzle-generator';

/**
 * Generate practice lessons using Stockfish
 */
async function generatePractices() {
  try {
    console.log('\n🎯 Generating practice lessons using Stockfish...\n');

    // Create Stockfish engine
    const engine = new StockfishEngine();
    await new Promise<void>((resolve) => {
      engine.once('ready', () => {
        console.log('✓ Stockfish engine ready\n');
        resolve();
      });
    });

    const generator = new PracticeGenerator(engine);

    // Generate just ONE practice with ONE lesson for testing
    const category: PracticeCategory = 'TACTICS';
    const difficulty: PracticeDifficulty = 'BEGINNER';

    console.log(`\nGenerating ${difficulty} ${category} practice with 1 lesson...\n`);

    let lesson: any = null;
    let attempts = 0;
    const maxAttempts = 5; // Try up to 5 times

    while (!lesson && attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`  Attempt ${attempts}/${maxAttempts}: Generating lesson...`);
        
        lesson = await generator.generateLesson({
          category,
          difficulty,
          getChess960Position,
          depth: 8, // Lower depth for faster generation
          minMoves: 10, // Fewer moves for faster generation
          maxMoves: 20,
        });

        if (lesson) {
          console.log(`    ✓ Generated: ${lesson.title}`);
          console.log(`    Initial FEN: ${lesson.initialFen}`);
          console.log(`    Solution: ${lesson.solution}`);
          console.log(`    Hints: ${lesson.hints.length}`);
        } else {
          console.log(`    ✗ Failed to generate lesson (attempt ${attempts})`);
        }
      } catch (error) {
        console.log(`    ✗ Error generating lesson (attempt ${attempts}):`, error instanceof Error ? error.message : error);
      }
    }

    if (lesson) {
      // Create practice in database
      const practice = await (db as any).practice.create({
        data: {
          title: `${category} - ${difficulty}`,
          description: `Practice ${category.toLowerCase()} concepts at ${difficulty.toLowerCase()} level`,
          category,
          difficulty,
          order: 0,
          lessons: {
            create: [{
              title: lesson.title,
              order: 1,
              initialFen: lesson.initialFen,
              instructions: lesson.instructions,
              solution: lesson.solution,
              hints: lesson.hints,
            }],
          },
        },
        include: {
          lessons: true,
        },
      });

      console.log(`\n✅ Created practice: ${practice.title}`);
      console.log(`   Lesson: ${practice.lessons[0].title}`);
      console.log(`   Category: ${practice.category}`);
      console.log(`   Difficulty: ${practice.difficulty}`);
      console.log(`   Solution: ${practice.lessons[0].solution}`);
    } else {
      console.log(`\n✗ Failed to generate practice lesson after ${maxAttempts} attempts`);
    }
    
    // Cleanup
    engine.removeAllListeners();
  } catch (error) {
    console.error('Error generating practices:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  generatePractices();
}

export { generatePractices };

