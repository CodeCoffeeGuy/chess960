import { db } from '../src';

async function checkPracticeFen() {
  try {
    const practices = await (db as any).practice.findMany({
      include: {
        lessons: {
          select: {
            title: true,
            initialFen: true,
          },
        },
      },
      // take: 3, // Show all practices
    });

    console.log('\n📋 Practice FENs:\n');
    for (const practice of practices) {
      console.log(`Practice: ${practice.title}`);
      for (const lesson of practice.lessons) {
        const isStarting = lesson.initialFen.includes('/8/8/8/8/8/8/') && 
                           lesson.initialFen.includes('pppppppp') && 
                           lesson.initialFen.includes('PPPPPPPP');
        console.log(`  Lesson: ${lesson.title}`);
        console.log(`  FEN: ${lesson.initialFen}`);
        console.log(`  Status: ${isStarting ? '⚠️  STARTING POSITION' : '✅ WITH MOVES'}`);
        console.log('');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

checkPracticeFen();

