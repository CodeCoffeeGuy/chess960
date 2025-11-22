import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/practice/[id] - Get practice details with lessons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    const practice = await (prisma as any).practice.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            completions: true,
          },
        },
      },
    });

    if (!practice) {
      return NextResponse.json(
        { error: 'Practice not found' },
        { status: 404 }
      );
    }

    // Get user completion if logged in
    const completion = session?.user?.id
      ? await (prisma as any).practiceCompletion.findUnique({
          where: {
            practiceId_userId: {
              practiceId: id,
              userId: session.user.id,
            },
          },
        })
      : null;

    return NextResponse.json({
      practice: {
        id: practice.id,
        title: practice.title,
        description: practice.description,
        category: practice.category,
        difficulty: practice.difficulty,
        order: practice.order,
        createdAt: practice.createdAt.toISOString(),
        updatedAt: practice.updatedAt.toISOString(),
        completionCount: practice._count.completions,
        isCompleted: !!completion,
        userScore: completion?.score || null,
        completedAt: completion?.completedAt.toISOString() || null,
        lessons: practice.lessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          order: lesson.order,
          initialFen: lesson.initialFen,
          instructions: lesson.instructions,
          solution: lesson.solution,
          hints: lesson.hints,
          createdAt: lesson.createdAt.toISOString(),
          updatedAt: lesson.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching practice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practice' },
      { status: 500 }
    );
  }
}

