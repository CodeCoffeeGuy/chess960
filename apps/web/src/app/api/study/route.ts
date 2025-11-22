import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/study - List studies (public or user's own)
export async function GET(request: NextRequest) {
  try {
    console.log('[Study API] GET /api/study called');
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId'); // Filter by user
    const publicOnly = searchParams.get('public') === 'true';
    const myStudies = searchParams.get('my') === 'true';
    
    console.log('[Study API] Session:', session?.user?.id ? 'authenticated' : 'guest');
    console.log('[Study API] Filters - userId:', userId, 'publicOnly:', publicOnly, 'myStudies:', myStudies);

    const where: any = {};

    if (myStudies && session?.user?.id) {
      where.ownerId = session.user.id;
    } else if (userId) {
      where.ownerId = userId;
      where.isPublic = true; // Only show public studies from other users
    } else if (publicOnly) {
      where.isPublic = true;
    } else if (!session?.user?.id) {
      // Not logged in - only show public studies
      where.isPublic = true;
    }
    // If logged in and no filter, show public studies + user's own studies
    // This is handled by the OR condition below

    console.log('[Study API] Executing query with where:', JSON.stringify(where));
    
    const whereClause = session?.user?.id && !userId && !myStudies && !publicOnly
      ? {
          OR: [
            { isPublic: true },
            { ownerId: session.user.id },
          ],
        }
      : where;
    
    const studies = await (prisma as any).study.findMany({
      where: whereClause,
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
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
    
    console.log('[Study API] Found', studies.length, 'studies');

    // Check if user liked each study
    const studyIds = studies.map(s => s.id);
    const userLikes = session?.user?.id
      ? await (prisma as any).studyLike.findMany({
          where: {
            studyId: { in: studyIds },
            userId: session.user.id,
          },
          select: {
            studyId: true,
          },
        })
      : [];
    const likedStudyIds = new Set(userLikes.map(l => l.studyId));

    return NextResponse.json({
      studies: studies.map(study => ({
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
        chapterCount: study._count.chapters,
        commentCount: study._count.comments,
        likeCount: study._count.likesUsers,
        isLiked: likedStudyIds.has(study.id),
        isOwner: session?.user?.id === study.ownerId,
      })),
    });
  } catch (error) {
    console.error('Error fetching studies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch studies' },
      { status: 500 }
    );
  }
}

// POST /api/study - Create a new study
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, isPublic = false } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Standard chess starting position FEN
    const standardStartingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const study = await (prisma as any).study.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        ownerId: session.user.id,
        isPublic: isPublic === true,
        chapters: {
          create: {
            name: 'Chapter 1',
            order: 0,
            initialFen: standardStartingFen,
            pgn: null,
          },
        },
      },
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
        id: study.id,
        title: study.title,
        description: study.description,
        owner: {
          id: study.owner.id,
          handle: study.owner.handle,
          image: study.owner.image,
        },
        isPublic: study.isPublic,
        createdAt: study.createdAt.toISOString(),
        updatedAt: study.updatedAt.toISOString(),
        likes: study.likes,
        views: study.views,
        chapterCount: study._count.chapters,
        commentCount: study._count.comments,
        likeCount: study._count.likesUsers,
        isLiked: false,
        isOwner: true,
      },
    });
  } catch (error) {
    console.error('Error creating study:', error);
    return NextResponse.json(
      { error: 'Failed to create study' },
      { status: 500 }
    );
  }
}

