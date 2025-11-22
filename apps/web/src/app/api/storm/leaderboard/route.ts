import { NextRequest, NextResponse } from 'next/server';
import { getStormLeaderboard } from '@/lib/storm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/storm/leaderboard - Get Storm leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const leaderboard = await getStormLeaderboard(limit);

    return NextResponse.json({
      leaderboard,
    });
  } catch (error) {
    console.error('Error getting Storm leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    );
  }
}

