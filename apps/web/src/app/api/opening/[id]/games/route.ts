import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/opening/[id]/games - Get games that used this opening
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if opening exists
    const opening = await (prisma as any).opening.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      );
    }

    const openingGames = await (prisma as any).openingGame.findMany({
      where: { openingId: id },
      include: {
        game: {
          include: {
            white: {
              select: {
                id: true,
                handle: true,
                image: true,
              },
            },
            black: {
              select: {
                id: true,
                handle: true,
                image: true,
              },
            },
            _count: {
              select: {
                moves: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      games: openingGames.map((og: any) => ({
        id: og.game.id,
        white: {
          id: og.game.white?.id,
          handle: og.game.white?.handle,
          image: og.game.white?.image,
          ratingBefore: og.game.whiteRatingBefore,
          ratingAfter: og.game.whiteRatingAfter,
        },
        black: {
          id: og.game.black?.id,
          handle: og.game.black?.handle,
          image: og.game.black?.image,
          ratingBefore: og.game.blackRatingBefore,
          ratingAfter: og.game.blackRatingAfter,
        },
        result: og.game.result,
        variant: og.game.variant,
        tc: og.game.tc,
        startedAt: og.game.startedAt?.toISOString(),
        endedAt: og.game.endedAt?.toISOString(),
        moveCount: og.game._count.moves,
      })),
    });
  } catch (error) {
    console.error('Error fetching opening games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opening games' },
      { status: 500 }
    );
  }
}

