import { db } from '@chess960/db';
import { getChess960Position } from '@chess960/utils';

export interface StormPuzzle {
  id: string;
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
  initialFen?: string;
}

export interface StormRunData {
  score: number;
  moves: number;
  errors: number;
  combo: number;
  time: number;
  highest: number;
  puzzles: string[];
}

/**
 * Get random puzzles for Storm mode
 * Storm mode uses puzzles with rating 1200-2500, no filtering by user rating
 */
export async function getStormPuzzles(count: number = 10): Promise<StormPuzzle[]> {
  try {
    const puzzles = await (db as any).puzzle.findMany({
      where: {
        rating: {
          gte: 1200,
          lte: 2500,
        },
      },
      take: count * 2, // Get more to randomize
      orderBy: {
        plays: 'desc', // Prefer more played puzzles
      },
      include: {
        game: {
          select: {
            variant: true,
            chess960Position: true,
          },
        },
      },
    });

    // Shuffle and take count
    const shuffled = puzzles.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // Get initial FEN for Chess960 puzzles
    const result = await Promise.all(
      selected.map(async (puzzle: any) => {
        let initialFen: string | undefined;
        if (puzzle.game?.variant === 'CHESS960' && puzzle.game?.chess960Position) {
          try {
            const chess960Pos = getChess960Position(puzzle.game.chess960Position);
            initialFen = chess960Pos.fen;
          } catch (error) {
            console.error('Error computing Chess960 FEN:', error);
          }
        }

        return {
          id: puzzle.id,
          fen: puzzle.fen,
          solution: puzzle.solution,
          moves: puzzle.moves || [puzzle.solution],
          rating: puzzle.rating,
          initialFen,
        };
      })
    );

    return result;
  } catch (error) {
    console.error('Error getting Storm puzzles:', error);
    return [];
  }
}

/**
 * Save Storm run to database
 */
export async function saveStormRun(
  userId: string,
  data: StormRunData
): Promise<{ id: string; isNewHigh: boolean; highScore: number }> {
  try {
    // Get today's date (UTC, date only)
    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));

    // Check if user has a run today
    const existingRun = await (db as any).stormRun.findFirst({
      where: {
        userId,
        day: {
          gte: day,
          lt: new Date(day.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        score: 'desc',
      },
    });

    // Check all-time high
    const allTimeHigh = await (db as any).stormRun.findFirst({
      where: {
        userId,
      },
      orderBy: {
        score: 'desc',
      },
    });

    const isNewHigh = !allTimeHigh || data.score > allTimeHigh.score;

    // Create new run
    const run = await (db as any).stormRun.create({
      data: {
        userId,
        score: data.score,
        moves: data.moves,
        errors: data.errors,
        combo: data.combo,
        time: data.time,
        highest: data.highest,
        puzzles: data.puzzles,
        day,
      },
    });

    return {
      id: run.id,
      isNewHigh,
      highScore: isNewHigh ? data.score : (allTimeHigh?.score || 0),
    };
  } catch (error) {
    console.error('Error saving Storm run:', error);
    throw error;
  }
}

/**
 * Get user's high score (all-time and today)
 */
export async function getStormHighScore(userId: string): Promise<{
  allTime: number;
  today: number;
}> {
  try {
    const today = new Date();
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0));

    const [allTime, todayRun] = await Promise.all([
      (db as any).stormRun.findFirst({
        where: { userId },
        orderBy: { score: 'desc' },
        select: { score: true },
      }),
      (db as any).stormRun.findFirst({
        where: {
          userId,
          day: {
            gte: day,
            lt: new Date(day.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { score: 'desc' },
        select: { score: true },
      }),
    ]);

    return {
      allTime: allTime?.score || 0,
      today: todayRun?.score || 0,
    };
  } catch (error) {
    console.error('Error getting Storm high score:', error);
    return { allTime: 0, today: 0 };
  }
}

/**
 * Get Storm leaderboard
 */
export async function getStormLeaderboard(limit: number = 10): Promise<
  Array<{
    userId: string;
    username: string;
    score: number;
    rank: number;
  }>
> {
  try {
    // Get top scores with user info
    const topRuns = await (db as any).stormRun.findMany({
      take: limit,
      orderBy: { score: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
          },
        },
      },
    });

    return topRuns.map((run: any, index: number) => ({
      userId: run.userId,
      username: run.user.handle || `user_${run.userId.substring(0, 8)}`,
      score: run.score,
      rank: index + 1,
    }));
  } catch (error) {
    console.error('Error getting Storm leaderboard:', error);
    return [];
  }
}

