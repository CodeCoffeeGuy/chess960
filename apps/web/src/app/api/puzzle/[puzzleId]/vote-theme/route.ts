import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@chess960/db';
import { getAuthService } from '@chess960/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ puzzleId: string }> }
) {
  try {
    const { puzzleId } = await params;
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { theme } = body;

    if (!theme || typeof theme !== 'string') {
      return NextResponse.json({ error: 'Theme required' }, { status: 400 });
    }

    // Valid themes (from theme detector)
    const validThemes = [
      'tactics', 'endgame', 'opening', 'middlegame', 'mate', 'mateIn1', 'mateIn2',
      'mateIn3', 'mateIn4', 'mateIn5', 'fork', 'pin', 'skewer', 'sacrifice',
      'discoveredAttack', 'doubleCheck', 'backRankMate', 'smotheredMate',
      'promotion', 'underPromotion', 'castling', 'enPassant', 'hangingPiece',
      'trappedPiece', 'deflection', 'attraction', 'clearance', 'interference',
      'xRayAttack', 'zugzwang', 'advancedPawn', 'rookEndgame', 'bishopEndgame',
      'knightEndgame', 'pawnEndgame', 'queenEndgame',
    ];

    if (!validThemes.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    // Check if puzzle exists
    const puzzle = await (db as any).puzzle.findUnique({
      where: { id: puzzleId },
    });

    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
    }

    // Check if user already voted for this theme
    const existingVote = await (db as any).puzzleThemeVote.findUnique({
      where: {
        userId_puzzleId_theme: {
          userId,
          puzzleId,
          theme,
        },
      },
    });

    if (existingVote) {
      // Remove vote (toggle off)
      await (db as any).puzzleThemeVote.delete({
        where: {
          userId_puzzleId_theme: {
            userId,
            puzzleId,
            theme,
          },
        },
      });

      // Update puzzle themes based on vote counts
      await updatePuzzleThemes(puzzleId);

      return NextResponse.json({ success: true, voted: false });
    }

    // Create vote
    await (db as any).puzzleThemeVote.create({
      data: {
        userId,
        puzzleId,
        theme,
      },
    });

    // Update puzzle themes based on vote counts
    await updatePuzzleThemes(puzzleId);

    return NextResponse.json({ success: true, voted: true });
  } catch (error) {
    console.error('Error voting on puzzle theme:', error);
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
  }
}

/**
 * Update puzzle themes based on vote counts
 * Themes with at least 2 votes are added to the puzzle
 */
async function updatePuzzleThemes(puzzleId: string) {
  const votes = await (db as any).puzzleThemeVote.groupBy({
    by: ['theme'],
    where: { puzzleId },
    _count: true,
  });

  // Get themes with at least 2 votes
  const themes = votes
    .filter((v: any) => v._count >= 2)
    .map((v: any) => v.theme);

  // Update puzzle
  await (db as any).puzzle.update({
    where: { id: puzzleId },
    data: { themes },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ puzzleId: string }> }
) {
  try {
    const { puzzleId } = await params;
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      const authToken = request.cookies.get('auth-token')?.value;
      if (authToken) {
        const authService = getAuthService();
        const payload = authService.verifyAuthToken(authToken);
        if (payload) {
          userId = payload.userId;
        }
      }
    }

    // Get puzzle with themes
    const puzzle = await (db as any).puzzle.findUnique({
      where: { id: puzzleId },
      select: {
        themes: true,
      },
    });

    if (!puzzle) {
      return NextResponse.json({ error: 'Puzzle not found' }, { status: 404 });
    }

    // Get vote counts for each theme
    const votes = await (db as any).puzzleThemeVote.groupBy({
      by: ['theme'],
      where: { puzzleId },
      _count: true,
    });

    // Get user's votes
    const userVotes = userId
      ? await (db as any).puzzleThemeVote.findMany({
          where: {
            userId,
            puzzleId,
          },
          select: {
            theme: true,
          },
        })
      : [];

    const userVotedThemes = new Set(userVotes.map((v: any) => v.theme));

    return NextResponse.json({
      themes: puzzle.themes || [],
      voteCounts: votes.map((v: any) => ({
        theme: v.theme,
        count: v._count,
      })),
      userVotes: Array.from(userVotedThemes),
    });
  } catch (error) {
    console.error('Error fetching puzzle theme votes:', error);
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
  }
}









