import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@chess960/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const userIdParam = searchParams.get('userId');

    const targetUserId = userIdParam || session?.user?.id;

    if (!targetUserId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const rounds = await (db as any).puzzleRound.findMany({
      where: {
        userId: targetUserId,
      },
      include: {
        puzzle: {
          select: {
            id: true,
            rating: true,
            themes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const total = await (db as any).puzzleRound.count({
      where: {
        userId: targetUserId,
      },
    });

    const stats = await (db as any).puzzleRound.aggregate({
      where: {
        userId: targetUserId,
      },
      _count: true,
      _sum: {
        win: true,
      },
    });

    const wins = await (db as any).puzzleRound.count({
      where: {
        userId: targetUserId,
        win: true,
      },
    });

    const puzzleRating = await (db as any).puzzleRating.findUnique({
      where: {
        userId: targetUserId,
      },
      select: {
        rating: true,
      },
    });

    return NextResponse.json({
      rounds: rounds.map((round: any) => ({
        id: round.id,
        puzzleId: round.puzzleId,
        puzzleRating: Number(round.puzzle.rating),
        win: round.win,
        ratingBefore: round.ratingBefore,
        ratingAfter: round.ratingAfter,
        ratingDiff: round.ratingDiff,
        createdAt: round.createdAt.toISOString(),
        themes: round.puzzle.themes || [],
      })),
      stats: {
        total: stats._count || 0,
        wins: wins || 0,
        losses: (stats._count || 0) - (wins || 0),
        winRate: stats._count > 0 ? Math.round((wins / stats._count) * 100) : 0,
        currentRating: puzzleRating ? Math.round(Number(puzzleRating.rating)) : 1500,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching puzzle history:', error);
    return NextResponse.json({ error: 'Failed to fetch puzzle history' }, { status: 500 });
  }
}









