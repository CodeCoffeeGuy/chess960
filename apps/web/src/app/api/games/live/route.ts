import { NextRequest, NextResponse } from 'next/server';
import { db } from '@chess960/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get all live games (started but not ended)
    const liveGames = await db.game.findMany({
      where: {
        startedAt: { not: null },
        endedAt: null,
      },
      include: {
        white: {
          select: {
            id: true,
            handle: true,
          },
        },
        black: {
          select: {
            id: true,
            handle: true,
          },
        },
        spectators: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            moves: true,
            spectators: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });

    const formattedGames = liveGames.map((game) => ({
      id: game.id,
      whiteId: game.whiteId,
      blackId: game.blackId,
      whiteHandle: game.white?.handle || 'Anonymous',
      blackHandle: game.black?.handle || 'Anonymous',
      tc: game.tc === 'ONE_PLUS_ZERO' ? '1+0' : '2+0',
      variant: game.variant,
      chess960Position: game.chess960Position,
      rated: game.rated,
      startedAt: game.startedAt?.toISOString() || null,
      moveCount: game._count.moves,
      spectatorCount: game._count.spectators,
    }));

    return NextResponse.json({ games: formattedGames });
  } catch (error) {
    console.error('Error fetching live games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live games' },
      { status: 500 }
    );
  }
}


