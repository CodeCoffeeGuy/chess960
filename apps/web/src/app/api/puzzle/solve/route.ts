import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { solvePuzzle } from '@/lib/puzzle-solver-service';
import { getChess960Position, getAuthService } from '@chess960/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Check for authenticated user (NextAuth session)
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.id) {
      // Authenticated user
      userId = session.user.id;
    } else {
      // Check for guest token
      const authToken = request.cookies.get('auth-token')?.value;
      if (authToken) {
        const authService = getAuthService();
        const payload = authService.verifyAuthToken(authToken);
        if (payload) {
          userId = payload.userId;
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in or continue as guest' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { puzzleId, solution, won, rated = true, difficulty = 0 } = body;

    if (!puzzleId || typeof won !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await solvePuzzle(userId, puzzleId, solution, won, rated, difficulty);

    // Get initial FEN if Chess960
    let initialFen: string | undefined;
    if (result.nextPuzzle?.game?.variant === 'CHESS960' && result.nextPuzzle?.game?.chess960Position) {
      try {
        const chess960Pos = getChess960Position(result.nextPuzzle.game.chess960Position);
        initialFen = chess960Pos.fen;
      } catch (error) {
        console.error('Error computing Chess960 FEN:', error);
      }
    }

    return NextResponse.json({
      success: true,
      ratingDiff: result.ratingDiff,
      newRating: result.newRating,
      nextPuzzle: result.nextPuzzle
        ? {
            ...result.nextPuzzle,
            initialFen,
          }
        : null,
    });
  } catch (error) {
    console.error('Error solving puzzle:', error);
    return NextResponse.json(
      { error: 'Failed to solve puzzle' },
      { status: 500 }
    );
  }
}






