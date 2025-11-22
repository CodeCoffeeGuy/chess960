import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/study/[id] - Get study details with chapters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    const study = await (prisma as any).study.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            handle: true,
            image: true,
          },
        },
        chapters: {
          orderBy: {
            order: 'asc',
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            likesUsers: true,
          },
        },
      },
    });

    if (!study) {
      return NextResponse.json(
        { error: 'Study not found' },
        { status: 404 }
      );
    }

    // Check if user can view this study
    if (!study.isPublic && study.ownerId !== session?.user?.id) {
      return NextResponse.json(
        { error: 'Study is private' },
        { status: 403 }
      );
    }

    // Check if user liked this study
    const isLiked = session?.user?.id
      ? await (prisma as any).studyLike.findUnique({
          where: {
            studyId_userId: {
              studyId: id,
              userId: session.user.id,
            },
          },
        }).then(l => !!l)
      : false;

    // Increment view count (only for non-owners)
    if (session?.user?.id !== study.ownerId) {
      await (prisma as any).study.update({
        where: { id },
        data: {
          views: {
            increment: 1,
          },
        },
      });
    }

    return NextResponse.json({
      study: {
        id: study.id,
        title: study.title,
        description: study.description,
        owner: {
          id: study.owner.id,
          handle: study.owner.handle,
          image: study.owner.image,
        },
                isPublic: study.isPublic,
                tags: study.tags || [],
                createdAt: study.createdAt.toISOString(),
                updatedAt: study.updatedAt.toISOString(),
                likes: study.likes,
                views: study.views,
                isLiked,
        isOwner: session?.user?.id === study.ownerId,
        chapters: study.chapters.map(chapter => ({
          id: chapter.id,
          name: chapter.name,
          order: chapter.order,
          initialFen: chapter.initialFen,
          pgn: chapter.pgn,
          createdAt: chapter.createdAt.toISOString(),
          updatedAt: chapter.updatedAt.toISOString(),
        })),
        comments: study.comments.map(comment => ({
          id: comment.id,
          movePly: comment.movePly,
          text: comment.text,
          createdAt: comment.createdAt.toISOString(),
          user: {
            id: comment.user.id,
            handle: comment.user.handle,
            image: comment.user.image,
          },
        })),
        likeCount: study._count.likesUsers,
      },
    });
  } catch (error) {
    console.error('Error fetching study:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study' },
      { status: 500 }
    );
  }
}

// PATCH /api/study/[id] - Update study
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
            const { title, description, isPublic, tags } = body;

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

            const updateData: any = {};
            if (title !== undefined) {
              if (title.trim().length === 0) {
                return NextResponse.json(
                  { error: 'Title cannot be empty' },
                  { status: 400 }
                );
              }
              updateData.title = title.trim();
            }
            if (description !== undefined) {
              updateData.description = description?.trim() || null;
            }
            if (isPublic !== undefined) {
              updateData.isPublic = isPublic === true;
            }
            if (tags !== undefined) {
              updateData.tags = Array.isArray(tags) ? tags.filter(t => t && t.trim().length > 0).map(t => t.trim()) : [];
            }

    const updated = await (prisma as any).study.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            handle: true,
            image: true,
          },
        },
        _count: {
          select: {
            chapters: true,
            comments: true,
            likesUsers: true,
          },
        },
      },
    });

            return NextResponse.json({
              study: {
                id: updated.id,
                title: updated.title,
                description: updated.description,
                owner: {
                  id: updated.owner.id,
                  handle: updated.owner.handle,
                  image: updated.owner.image,
                },
                isPublic: updated.isPublic,
                tags: updated.tags || [],
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
                likes: updated.likes,
                views: updated.views,
                chapterCount: updated._count.chapters,
                commentCount: updated._count.comments,
                likeCount: updated._count.likesUsers,
                isOwner: true,
              },
            });
  } catch (error) {
    console.error('Error updating study:', error);
    return NextResponse.json(
      { error: 'Failed to update study' },
      { status: 500 }
    );
  }
}

// DELETE /api/study/[id] - Delete study
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

    await (prisma as any).study.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting study:', error);
    return NextResponse.json(
      { error: 'Failed to delete study' },
      { status: 500 }
    );
  }
}

