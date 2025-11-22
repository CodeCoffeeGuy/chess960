import { db } from '@chess960/db';
import { getOrCreatePuzzleRating, updatePuzzleRating } from './puzzle-rating-service';

/**
 * Solve a puzzle and get the next puzzle
 */
export async function solvePuzzle(
  userId: string,
  puzzleId: string,
  solution: string,
  won: boolean,
  rated: boolean = true,
  difficulty: number = 0
): Promise<{
  puzzle: any;
  ratingDiff: number;
  newRating: number;
  nextPuzzle: any | null;
}> {
  // Ensure user exists in database (needed for foreign key constraints)
  const existingUser = await (db as any).user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    // Create user if it doesn't exist (for guest users)
    try {
      await (db as any).user.create({
        data: {
          id: userId,
          handle: `guest_${userId.substring(0, 8)}`,
          email: null,
        },
      });
    } catch (error: any) {
      // If user creation fails (e.g., handle conflict), try to find existing user
      // This can happen if multiple requests try to create the same user
      const user = await (db as any).user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new Error('Failed to create or find user');
      }
    }
  }

  // Get puzzle
  const puzzle = await (db as any).puzzle.findUnique({
    where: { id: puzzleId },
  });

  if (!puzzle) {
    throw new Error('Puzzle not found');
  }

  // Check if already solved
  const existingRound = await (db as any).puzzleRound.findFirst({
    where: {
      userId,
      puzzleId,
    },
  });

  // Get user's current puzzle rating
  const userRating = await getOrCreatePuzzleRating(userId);
  const ratingBefore = Math.round(userRating.rating);

  // Update rating if this is a new solve and rated mode
  // Lichess-style: Rating is only calculated on first attempt
  // - First attempt wrong → negative rating
  // - First attempt correct → positive rating
  // - Second attempt correct → no rating change (first attempt counts)
  let ratingDiff = 0;
  let newRating = ratingBefore;

  if (!existingRound) {
    // First time solving this puzzle - calculate rating based on result
    if (rated) {
      // Apply rating change based on win/loss (first attempt counts)
      const ratingUpdate = await updatePuzzleRating(userId, puzzle.rating, won);
      newRating = ratingUpdate.rating;
      ratingDiff = ratingUpdate.ratingDiff;
    } else {
      // Casual mode - no rating change
      ratingDiff = 0;
      newRating = ratingBefore;
    }

    // Create puzzle round (always record attempt, even in casual mode)
    await (db as any).puzzleRound.create({
      data: {
        userId,
        puzzleId,
        win: won,
        ratingBefore,
        ratingAfter: newRating,
        ratingDiff,
      },
    });

    // Increment puzzle plays
    await (db as any).puzzle.update({
      where: { id: puzzleId },
      data: { plays: { increment: 1 } },
    });
  } else {
    // Already attempted - second attempt or later
    // Update the round to reflect the new result, but don't recalculate rating
    // The first attempt's rating change is what counts
    await (db as any).puzzleRound.update({
      where: {
        id: existingRound.id,
      },
      data: {
        win: won, // Update win status
        // Keep original ratingBefore, ratingAfter, and ratingDiff from first attempt
      },
    });
    
    // Return the original rating data from first attempt
    ratingDiff = existingRound.ratingDiff;
    newRating = existingRound.ratingAfter;
  }

  // Get next puzzle based on updated rating and difficulty setting
  // Target rating: userRating + difficulty (adjusted by user preference)
  const targetRating = newRating + difficulty;
  const ratingRange = 100; // ±100 rating range

  const nextPuzzle = await (db as any).puzzle.findFirst({
    where: {
      id: { not: puzzleId }, // Not the same puzzle
      rating: {
        gte: targetRating - ratingRange,
        lte: targetRating + ratingRange,
      },
      // Not already solved by this user
      rounds: {
        none: {
          userId,
        },
      },
    },
    orderBy: {
      rating: 'asc', // Closest to target
    },
  });

  return {
    puzzle,
    ratingDiff,
    newRating,
    nextPuzzle,
  };
}

/**
 * Get next puzzle for user based on their rating
 */
export async function getNextPuzzle(
  userId: string,
  difficultyDelta: number = 50
): Promise<any | null> {
  const userRating = await getOrCreatePuzzleRating(userId);
  const targetRating = Math.round(userRating.rating) + difficultyDelta;
  const ratingRange = 100;

  // Find puzzle that user hasn't solved yet
  const puzzle = await (db as any).puzzle.findFirst({
    where: {
      rating: {
        gte: targetRating - ratingRange,
        lte: targetRating + ratingRange,
      },
      rounds: {
        none: {
          userId,
        },
      },
    },
    orderBy: {
      rating: 'asc',
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

  return puzzle;
}






