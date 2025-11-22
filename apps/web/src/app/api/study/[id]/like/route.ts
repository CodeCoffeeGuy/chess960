import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/study/[id]/like - Like/unlike a study
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

    // Check if study exists
    const study = await (prisma as any).study.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    // Check if already liked
    const existingLike = await (prisma as any).studyLike.findUnique({
      where: {
        studyId_userId: {
          studyId: id,
          userId: session.user.id,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.$transaction([
        (prisma as any).studyLike.delete({
          where: {
            studyId_userId: {
              studyId: id,
              userId: session.user.id,
            },
          },
        }),
        (prisma as any).study.update({
          where: { id },
          data: {
            likes: {
              decrement: 1,
            },
          },
        }),
      ]);

      return NextResponse.json({ liked: false });
    } else {
      // Like
      await prisma.$transaction([
        (prisma as any).studyLike.create({
          data: {
            studyId: id,
            userId: session.user.id,
          },
        }),
        (prisma as any).study.update({
          where: { id },
          data: {
            likes: {
              increment: 1,
            },
          },
        }),
      ]);

      return NextResponse.json({ liked: true });
    }
  } catch (error) {
    console.error('Error toggling study like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}

