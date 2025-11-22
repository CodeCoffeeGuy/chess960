import { db } from '../src';

async function checkPractices() {
  try {
    const practices = await (db as any).practice.findMany({
      include: {
        _count: {
          select: {
            lessons: true,
          },
        },
        lessons: {
          select: {
            title: true,
            order: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { difficulty: 'asc' },
      ],
    });

    console.log(`\n📊 Total practices: ${practices.length}\n`);

    if (practices.length === 0) {
      console.log('No practices found in database.\n');
      return;
    }

    let totalLessons = 0;
    for (const practice of practices) {
      const lessonCount = practice._count.lessons;
      totalLessons += lessonCount;
      console.log(`✓ ${practice.title} (${practice.category} - ${practice.difficulty})`);
      console.log(`  Lessons: ${lessonCount}`);
      if (practice.lessons.length > 0) {
        practice.lessons.forEach((lesson: any) => {
          console.log(`    - ${lesson.title}`);
        });
      }
      console.log('');
    }

    console.log(`📚 Total lessons: ${totalLessons}\n`);
  } catch (error) {
    console.error('Error checking practices:', error);
  } finally {
    await db.$disconnect();
  }
}

checkPractices();

