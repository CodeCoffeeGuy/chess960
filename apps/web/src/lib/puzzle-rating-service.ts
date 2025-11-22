import { db } from '@chess960/db';
import { updateGlicko2, type Rating } from '@chess960/rating';

/**
 * Get or create puzzle rating for a user
 */
export async function getOrCreatePuzzleRating(userId: string): Promise<Rating> {
  let puzzleRating = await (db as any).puzzleRating.findUnique({
    where: { userId },
  });

  if (!puzzleRating) {
    puzzleRating = await (db as any).puzzleRating.create({
      data: {
        userId,
        rating: 1500,
        rd: 350,
        vol: 0.06,
      },
    });
  }

  return {
    rating: Number(puzzleRating.rating),
    rd: Number(puzzleRating.rd),
    vol: Number(puzzleRating.vol),
  };
}

/**
 * Update puzzle rating after solving a puzzle
 */
export async function updatePuzzleRating(
  userId: string,
  puzzleRating: number,
  won: boolean
): Promise<{ rating: number; ratingDiff: number }> {
  const userRating = await getOrCreatePuzzleRating(userId);
  const puzzleRatingObj: Rating = {
    rating: puzzleRating,
    rd: 350, // Standard puzzle RD
    vol: 0.06,
  };

  // Calculate new rating using Glicko-2
  const result = won ? 1 : 0;
  const newRating = updateGlicko2(userRating, [{ opponent: puzzleRatingObj, result }]);

  // Calculate raw rating difference
  let ratingDiff = Math.round(newRating.rating - userRating.rating);

  // For puzzles, ensure that solving correctly ALWAYS gives a positive rating change
  // This prevents negative changes when a high-rated player solves an easy puzzle
  if (won) {
    if (ratingDiff <= 0) {
      // If solving correctly but rating didn't increase, apply minimum gain
      // Minimum gain is based on puzzle difficulty relative to user rating
      const ratingGap = puzzleRating - userRating.rating;
      
      // If puzzle is easier (lower rating), still give small positive gain
      // If puzzle is harder (higher rating), give larger gain
      if (ratingGap < 0) {
        // Puzzle is easier - give small positive gain (1-5 points)
        ratingDiff = Math.max(1, Math.min(5, Math.abs(ratingGap) / 100));
      } else {
        // Puzzle is harder - ensure at least 1 point gain
        ratingDiff = Math.max(1, ratingDiff);
      }
      
      // Update the rating to reflect the minimum gain
      const adjustedRating = userRating.rating + ratingDiff;
      newRating.rating = adjustedRating;
    }
    // If ratingDiff is already positive, keep it as is
  } else {
    // For losses, ratingDiff should already be negative or zero from Glicko-2
    // No need to adjust - losses should decrease rating
  }

  // Update database
  await (db as any).puzzleRating.upsert({
    where: { userId },
    create: {
      userId,
      rating: newRating.rating,
      rd: newRating.rd,
      vol: newRating.vol,
    },
    update: {
      rating: newRating.rating,
      rd: newRating.rd,
      vol: newRating.vol,
    },
  });

  return {
    rating: Math.round(newRating.rating),
    ratingDiff,
  };
}







