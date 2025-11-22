import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getStormPuzzles, getStormHighScore } from '@/lib/storm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/storm - Get Storm puzzles and user high score
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Get puzzles for Storm mode
    const puzzles = await getStormPuzzles(10);

    if (puzzles.length === 0) {
      return NextResponse.json(
        { error: 'No puzzles available' },
        { status: 404 }
      );
    }

    // Get user's high score if logged in
    let high = { allTime: 0, today: 0 };
    if (userId) {
      high = await getStormHighScore(userId);
    }

    return NextResponse.json({
      puzzles,
      high,
    });
  } catch (error) {
    console.error('Error getting Storm data:', error);
    return NextResponse.json(
      { error: 'Failed to get Storm data' },
      { status: 500 }
    );
  }
}

