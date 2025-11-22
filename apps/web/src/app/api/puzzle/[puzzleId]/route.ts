import { NextRequest, NextResponse } from 'next/server';
import { db } from '@chess960/db';
import { getChess960Position } from '@chess960/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { puzzleId: string } }
) {
  try {
    const puzzle = await (db as any).puzzle.findUnique({
      where: { id: params.puzzleId },
      include: {
        game: {
          select: {
            id: true,
            variant: true,
            chess960Position: true,
            whiteId: true,
            blackId: true,
            whiteRatingBefore: true,
            blackRatingBefore: true,
            tc: true,
            white: {
              select: {
                handle: true,
              },
            },
            black: {
              select: {
                handle: true,
              },
            },
          },
        },
      },
    });

    if (!puzzle) {
      return NextResponse.json(
        { error: 'Puzzle not found' },
        { status: 404 }
      );
    }

    let initialFen: string | undefined;
    if (puzzle.game?.variant === 'CHESS960' && puzzle.game?.chess960Position) {
      try {
        const chess960Pos = getChess960Position(puzzle.game.chess960Position);
        initialFen = chess960Pos.fen;
      } catch (error) {
        console.error('Error computing Chess960 FEN:', error);
      }
    }

    // Format game info
    const gameInfo = puzzle.game ? {
      id: puzzle.game.id,
      variant: puzzle.game.variant,
      timeControl: puzzle.game.tc,
      white: {
        handle: puzzle.game.white?.handle || 'Anonymous',
        rating: puzzle.game.whiteRatingBefore,
      },
      black: {
        handle: puzzle.game.black?.handle || 'Anonymous',
        rating: puzzle.game.blackRatingBefore,
      },
    } : null;

    return NextResponse.json({
      puzzle: {
        ...puzzle,
        initialFen,
        gameInfo,
      },
    });
  } catch (error) {
    console.error('Error fetching puzzle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch puzzle' },
      { status: 500 }
    );
  }
}






