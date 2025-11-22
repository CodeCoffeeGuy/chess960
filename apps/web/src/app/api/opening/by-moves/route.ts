import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@chess960/db';
import { Chess } from 'chess.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/opening/by-moves - Get opening by moves (UCI format)
// This endpoint finds or creates an opening based on the moves played
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const moves = searchParams.get('moves'); // UCI moves separated by spaces, e.g., "e2e4 e7e5"

    if (!moves || moves.trim().length === 0) {
      return NextResponse.json(
        { error: 'Moves parameter is required' },
        { status: 400 }
      );
    }

    const movesArray = moves.trim().split(/\s+/);
    
    // Validate moves by playing them
    const chess = new Chess();
    for (const move of movesArray) {
      try {
        chess.move({ from: move.substring(0, 2), to: move.substring(2, 4) });
      } catch (error) {
        return NextResponse.json(
          { error: `Invalid move: ${move}` },
          { status: 400 }
        );
      }
    }

    const fen = chess.fen();

    // Try to find existing opening
    let opening = await (prisma as any).opening.findUnique({
      where: { moves: moves.trim() },
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

    // If not found, create a basic opening entry
    if (!opening) {
      // Try to find a name based on position (this is simplified - in production you'd use an opening database)
      const moveCount = movesArray.length;
      const name = moveCount <= 2 
        ? 'Opening' 
        : moveCount <= 6 
        ? 'Early Opening' 
        : 'Opening Variation';

      opening = await (prisma as any).opening.create({
        data: {
          name,
          moves: moves.trim(),
          fen,
        },
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
    }

    // Get move statistics
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
        gameCount: opening._count.games,
        moves: movesWithStats,
        createdAt: opening.createdAt.toISOString(),
        updatedAt: opening.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching opening by moves:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opening' },
      { status: 500 }
    );
  }
}

