import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/study/[id]/comment/[commentId] - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, commentId } = await params;
    const body = await request.json();
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    // Check if comment exists and user owns it
    const comment = await (prisma as any).studyComment.findUnique({
      where: { id: commentId },
      select: { userId: true, studyId: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.studyId !== id) {
      return NextResponse.json(
        { error: 'Comment does not belong to this study' },
        { status: 400 }
      );
    }

    // Check if user owns the comment or is the study owner
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

    if (comment.userId !== session.user.id && study.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const updated = await (prisma as any).studyComment.update({
      where: { id: commentId },
      data: { text: text.trim() },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      comment: {
        id: updated.id,
        movePly: updated.movePly,
        text: updated.text,
        createdAt: updated.createdAt.toISOString(),
        user: {
          id: updated.user.id,
          handle: updated.user.handle,
          image: updated.user.image,
        },
      },
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

// DELETE /api/study/[id]/comment/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, commentId } = await params;

    // Check if comment exists and user owns it
    const comment = await (prisma as any).studyComment.findUnique({
      where: { id: commentId },
      select: { userId: true, studyId: true },
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.studyId !== id) {
      return NextResponse.json(
        { error: 'Comment does not belong to this study' },
        { status: 400 }
      );
    }

    // Check if user owns the comment or is the study owner
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

    if (comment.userId !== session.user.id && study.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await (prisma as any).studyComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

