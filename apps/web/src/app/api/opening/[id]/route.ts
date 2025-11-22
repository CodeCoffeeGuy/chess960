import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@chess960/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/opening/[id] - Get opening details with moves and statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const opening = await (prisma as any).opening.findUnique({
      where: { id },
      include: {
        movesData: {
          orderBy: {
            moveNumber: 'asc',
          },
        },
        _count: {
          select: {
            games: true,
          },
        },
      },
    });

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      );
    }

    // Calculate statistics
    const totalGames = opening._count.games;
    const movesWithStats = opening.movesData.map((move: any) => {
      const total = move.gamesPlayed;
      const winRate = total > 0 ? (move.gamesWon / total) * 100 : 0;
      const drawRate = total > 0 ? (move.gamesDrawn / total) * 100 : 0;
      const lossRate = total > 0 ? (move.gamesLost / total) * 100 : 0;

      return {
        id: move.id,
        move: move.move,
        moveNumber: move.moveNumber,
        gamesPlayed: move.gamesPlayed,
        gamesWon: move.gamesWon,
        gamesDrawn: move.gamesDrawn,
        gamesLost: move.gamesLost,
        winRate: Math.round(winRate * 10) / 10,
        drawRate: Math.round(drawRate * 10) / 10,
        lossRate: Math.round(lossRate * 10) / 10,
        avgRating: move.avgRating ? parseFloat(move.avgRating.toString()) : null,
      };
    });

    return NextResponse.json({
      opening: {
        id: opening.id,
        name: opening.name,
        eco: opening.eco,
        moves: opening.moves,
        fen: opening.fen,
        chess960Position: opening.chess960Position,
        gameCount: totalGames,
        moveStats: movesWithStats,
        createdAt: opening.createdAt.toISOString(),
        updatedAt: opening.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching opening:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opening' },
      { status: 500 }
    );
  }
}

