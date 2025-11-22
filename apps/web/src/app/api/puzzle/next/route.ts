import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getNextPuzzle } from '@/lib/puzzle-solver-service';
import { getChess960Position } from '@chess960/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const difficultyDelta = searchParams.get('delta')
      ? parseInt(searchParams.get('delta')!, 10)
      : 50;

    const puzzle = await getNextPuzzle(session.user.id, difficultyDelta);

    if (!puzzle) {
      return NextResponse.json(
        { puzzle: null, error: 'No puzzle available' },
        { status: 404 }
      );
    }

    // Get initial FEN if Chess960
    let initialFen: string | undefined;
    if (puzzle.game?.variant === 'CHESS960' && puzzle.game?.chess960Position) {
      try {
        const chess960Pos = getChess960Position(puzzle.game.chess960Position);
        initialFen = chess960Pos.fen;
      } catch (error) {
        console.error('Error computing Chess960 FEN:', error);
      }
    }

    return NextResponse.json({
      puzzle: {
        ...puzzle,
        initialFen,
      },
    });
  } catch (error) {
    console.error('Error getting next puzzle:', error);
    return NextResponse.json(
      { error: 'Failed to get next puzzle' },
      { status: 500 }
    );
  }
}














