import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { saveStormRun } from '@/lib/storm-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/storm/record - Record a Storm run
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { score, moves, errors, combo, time, highest, puzzles } = body;

    // Validate data
    if (
      typeof score !== 'number' ||
      typeof moves !== 'number' ||
      typeof errors !== 'number' ||
      typeof combo !== 'number' ||
      typeof time !== 'number' ||
      typeof highest !== 'number' ||
      !Array.isArray(puzzles)
    ) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    // Save run
    const result = await saveStormRun(session.user.id, {
      score,
      moves,
      errors,
      combo,
      time,
      highest,
      puzzles,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error recording Storm run:', error);
    return NextResponse.json(
      { error: 'Failed to record Storm run' },
      { status: 500 }
    );
  }
}

