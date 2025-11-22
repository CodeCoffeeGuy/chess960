import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/practice/[id]/complete - Mark practice as completed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { score } = body;

    // Check if practice exists
    const practice = await (prisma as any).practice.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!practice) {
      return NextResponse.json(
        { error: 'Practice not found' },
        { status: 404 }
      );
    }

    // Check if already completed
    const existing = await (prisma as any).practiceCompletion.findUnique({
      where: {
        practiceId_userId: {
          practiceId: id,
          userId: session.user.id,
        },
      },
    });

    if (existing) {
      // Update existing completion
      const updated = await (prisma as any).practiceCompletion.update({
        where: {
          practiceId_userId: {
            practiceId: id,
            userId: session.user.id,
          },
        },
        data: {
          score: score !== undefined ? score : null,
          completedAt: new Date(),
        },
      });

      // Fetch updated practice with completion
      const practice = await (prisma as any).practice.findUnique({
        where: { id },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { completions: true },
          },
        },
      });

      return NextResponse.json({
        completion: {
          id: updated.id,
          score: updated.score,
          completedAt: updated.completedAt.toISOString(),
        },
        practice: {
          id: practice.id,
          title: practice.title,
          description: practice.description,
          category: practice.category,
          difficulty: practice.difficulty,
          isCompleted: true,
          userScore: updated.score,
          completedAt: updated.completedAt.toISOString(),
          completionCount: practice._count.completions,
        },
      });
    } else {
      // Create new completion
      const completion = await (prisma as any).practiceCompletion.create({
        data: {
          practiceId: id,
          userId: session.user.id,
          score: score !== undefined ? score : null,
        },
      });

      // Fetch updated practice with completion
      const practice = await (prisma as any).practice.findUnique({
        where: { id },
        include: {
          lessons: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { completions: true },
          },
        },
      });

      return NextResponse.json({
        completion: {
          id: completion.id,
          score: completion.score,
          completedAt: completion.completedAt.toISOString(),
        },
        practice: {
          id: practice.id,
          title: practice.title,
          description: practice.description,
          category: practice.category,
          difficulty: practice.difficulty,
          isCompleted: true,
          userScore: completion.score,
          completedAt: completion.completedAt.toISOString(),
          completionCount: practice._count.completions,
        },
      });
    }
  } catch (error) {
    console.error('Error completing practice:', error);
    return NextResponse.json(
      { error: 'Failed to complete practice' },
      { status: 500 }
    );
  }
}

