import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/practice - List all practices
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // OPENING, MIDDLEGAME, etc.
    const difficulty = searchParams.get('difficulty'); // BEGINNER, INTERMEDIATE, etc.

    const where: any = {};
    if (category) {
      where.category = category;
    }
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const practices = await (prisma as any).practice.findMany({
      where,
      include: {
        _count: {
          select: {
            lessons: true,
            completions: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { difficulty: 'asc' },
        { order: 'asc' },
      ],
    });

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Get user completions if logged in
    const practiceIds = practices.map(p => p.id);
    const userCompletions = userId
      ? await (prisma as any).practiceCompletion.findMany({
          where: {
            practiceId: { in: practiceIds },
            userId,
          },
          select: {
            practiceId: true,
            score: true,
            completedAt: true,
          },
        })
      : [];
    const completionMap = new Map(
      userCompletions.map(c => [c.practiceId, c])
    );

    return NextResponse.json({
      practices: practices.map(practice => {
        const completion = completionMap.get(practice.id);
        return {
          id: practice.id,
          title: practice.title,
          description: practice.description,
          category: practice.category,
          difficulty: practice.difficulty,
          order: practice.order,
          createdAt: practice.createdAt.toISOString(),
          updatedAt: practice.updatedAt.toISOString(),
          lessonCount: practice._count.lessons,
          completionCount: practice._count.completions,
          isCompleted: !!completion,
          userScore: completion?.score || null,
          completedAt: completion?.completedAt.toISOString() || null,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching practices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practices' },
      { status: 500 }
    );
  }
}

