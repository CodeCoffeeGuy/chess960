import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/practice/create - Create a new practice (admin only for now)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (optional - remove this check if you want anyone to create practices)
    const user = await (prisma as any).user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    // For now, allow any authenticated user to create practices
    // You can add admin check later: if (!user?.isAdmin) { return NextResponse.json({ error: 'Admin only' }, { status: 403 }); }

    const body = await request.json();
    const { title, description, category, difficulty, order, lessons } = body;

    if (!title || !category || !difficulty) {
      return NextResponse.json(
        { error: 'Title, category, and difficulty are required' },
        { status: 400 }
      );
    }

    const practice = await (prisma as any).practice.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        order: order || 0,
        lessons: lessons
          ? {
              create: lessons.map((lesson: any, index: number) => ({
                title: lesson.title,
                order: lesson.order ?? index,
                initialFen: lesson.initialFen,
                instructions: lesson.instructions,
                solution: lesson.solution || null,
                hints: lesson.hints || [],
              })),
            }
          : undefined,
      },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            lessons: true,
            completions: true,
          },
        },
      },
    });

    return NextResponse.json({
      practice: {
        id: practice.id,
        title: practice.title,
        description: practice.description,
        category: practice.category,
        difficulty: practice.difficulty,
        order: practice.order,
        lessonCount: practice._count.lessons,
        completionCount: practice._count.completions,
        lessons: practice.lessons.map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          order: lesson.order,
          initialFen: lesson.initialFen,
          instructions: lesson.instructions,
          solution: lesson.solution,
          hints: lesson.hints,
        })),
      },
    });
  } catch (error) {
    console.error('Error creating practice:', error);
    return NextResponse.json(
      { error: 'Failed to create practice' },
      { status: 500 }
    );
  }
}

