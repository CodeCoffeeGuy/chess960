import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/study/[id]/chapter - Add a chapter to a study
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
    const { name, initialFen, pgn, order } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Chapter name is required' },
        { status: 400 }
      );
    }

    if (!initialFen || initialFen.trim().length === 0) {
      return NextResponse.json(
        { error: 'Initial FEN is required' },
        { status: 400 }
      );
    }

    // Check if study exists and user owns it
    const study = await (prisma as any).study.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    if (study.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get max order if not provided
    let chapterOrder = order;
    if (chapterOrder === undefined) {
      const maxOrder = await (prisma as any).studyChapter.findFirst({
        where: { studyId: id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      chapterOrder = maxOrder ? maxOrder.order + 1 : 0;
    }

    const chapter = await (prisma as any).studyChapter.create({
      data: {
        studyId: id,
        name: name.trim(),
        initialFen: initialFen.trim(),
        pgn: pgn?.trim() || null,
        order: chapterOrder,
      },
    });

    return NextResponse.json({
      chapter: {
        id: chapter.id,
        name: chapter.name,
        order: chapter.order,
        initialFen: chapter.initialFen,
        pgn: chapter.pgn,
        createdAt: chapter.createdAt.toISOString(),
        updatedAt: chapter.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json(
      { error: 'Failed to create chapter' },
      { status: 500 }
    );
  }
}

// PATCH /api/study/[id]/chapter - Update a chapter
export async function PATCH(
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
    const { chapterId, name, initialFen, pgn, order } = body;

    if (!chapterId) {
      return NextResponse.json(
        { error: 'Chapter ID is required' },
        { status: 400 }
      );
    }

    // Check if study exists and user owns it
    const study = await (prisma as any).study.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    if (study.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if chapter belongs to this study
    const chapter = await (prisma as any).studyChapter.findUnique({
      where: { id: chapterId },
      select: { studyId: true },
    });

    if (!chapter || chapter.studyId !== id) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) {
      if (name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Chapter name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }
    if (initialFen !== undefined) {
      updateData.initialFen = initialFen.trim();
    }
    if (pgn !== undefined) {
      updateData.pgn = pgn?.trim() || null;
    }
    if (order !== undefined) {
      updateData.order = order;
    }

    const updated = await (prisma as any).studyChapter.update({
      where: { id: chapterId },
      data: updateData,
    });

    return NextResponse.json({
      chapter: {
        id: updated.id,
        name: updated.name,
        order: updated.order,
        initialFen: updated.initialFen,
        pgn: updated.pgn,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating chapter:', error);
    return NextResponse.json(
      { error: 'Failed to update chapter' },
      { status: 500 }
    );
  }
}

// DELETE /api/study/[id]/chapter - Delete a chapter
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get('chapterId');

    if (!chapterId) {
      return NextResponse.json(
        { error: 'Chapter ID is required' },
        { status: 400 }
      );
    }

    // Check if study exists and user owns it
    const study = await (prisma as any).study.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    if (study.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if chapter belongs to this study
    const chapter = await (prisma as any).studyChapter.findUnique({
      where: { id: chapterId },
      select: { studyId: true },
    });

    if (!chapter || chapter.studyId !== id) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    await (prisma as any).studyChapter.delete({
      where: { id: chapterId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    return NextResponse.json(
      { error: 'Failed to delete chapter' },
      { status: 500 }
    );
  }
}

