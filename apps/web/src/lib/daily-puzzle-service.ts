import { db } from '@chess960/db';

export interface DailyPuzzle {
  id: string;
  gameId: string;
  fen: string;
  solution: string;
  moves: string[];
  rating: number;
}

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
let cachedPuzzle: DailyPuzzle | null = null;
let cacheTimestamp: number = 0;

/**
 * Get today's daily puzzle.
 * 
 * Note: Puzzles are generated ONCE using Stockfish (via generate-puzzles script),
 * then one is SELECTED each day from the database. The daily puzzle is the same
 * for all users and changes once per day.
 * 
 * Returns cached puzzle if available and fresh.
 */
export async function getDailyPuzzle(): Promise<DailyPuzzle | null> {
  // Check cache first
  const now = Date.now();
  if (cachedPuzzle && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    console.log('[Daily Puzzle] Returning cached puzzle');
    return cachedPuzzle;
  }

  try {
    // Use UTC dates to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    console.log('[Daily Puzzle] Looking for puzzle between:', today.toISOString(), 'and', tomorrow.toISOString());

    // Try to find puzzle assigned for today
    const existingPuzzle = await (db as any).puzzle.findFirst({
      where: {
        day: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        game: {
          select: {
            id: true,
            variant: true,
            chess960Position: true,
          },
        },
      },
    });

    if (existingPuzzle) {
      console.log('[Daily Puzzle] Found existing puzzle:', existingPuzzle.id);
      cachedPuzzle = {
        id: existingPuzzle.id,
        gameId: existingPuzzle.gameId,
        fen: existingPuzzle.fen,
        solution: existingPuzzle.solution,
        moves: existingPuzzle.moves,
        rating: existingPuzzle.rating,
      };
      cacheTimestamp = now;
      return cachedPuzzle;
    }

    console.log('[Daily Puzzle] No puzzle for today, selecting new one...');
    // No puzzle for today, select a new one
    const newPuzzle = await selectNewDailyPuzzle(today);
    
    if (newPuzzle) {
      console.log('[Daily Puzzle] Selected new puzzle:', newPuzzle.id);
      cachedPuzzle = newPuzzle;
      cacheTimestamp = now;
      return newPuzzle;
    }

    // If no puzzle was assigned for today, try to get any random puzzle as fallback
    console.warn('[Daily Puzzle] Failed to select new puzzle, trying fallback...');
    const fallbackPuzzle = await (db as any).puzzle.findFirst({
      where: {
        rating: {
          gte: 1500,
          lte: 2500,
        },
      },
      orderBy: {
        plays: 'desc',
      },
      include: {
        game: {
          select: {
            id: true,
            variant: true,
            chess960Position: true,
          },
        },
      },
    });

    if (fallbackPuzzle) {
      console.log('[Daily Puzzle] Using fallback puzzle:', fallbackPuzzle.id);
      return {
        id: fallbackPuzzle.id,
        gameId: fallbackPuzzle.gameId,
        fen: fallbackPuzzle.fen,
        solution: fallbackPuzzle.solution,
        moves: fallbackPuzzle.moves,
        rating: fallbackPuzzle.rating,
      };
    }

    console.warn('[Daily Puzzle] No puzzles available in database');
    return null;
  } catch (error) {
    console.error('[Daily Puzzle] Error fetching daily puzzle:', error);
    // Return cached puzzle if available, even if stale
    if (cachedPuzzle) {
      console.log('[Daily Puzzle] Returning stale cached puzzle due to error');
      return cachedPuzzle;
    }
    return null;
  }
}

/**
 * Select a new puzzle to be today's daily puzzle.
 */
async function selectNewDailyPuzzle(day: Date): Promise<DailyPuzzle | null> {
  try {
    // Find puzzles that haven't been used as daily puzzles yet
    // Prioritize puzzles with good ratings (1500-2500)
    // For new puzzles (plays = 0), we'll still select them based on rating
    const candidates = await (db as any).puzzle.findMany({
      where: {
        day: null, // Not used before
        rating: {
          gte: 1500,
          lte: 2500,
        },
      },
      orderBy: [
        {
          plays: 'desc', // Prefer puzzles that have been played (if any)
        },
        {
          rating: 'desc', // Then by rating
        },
      ],
      take: 50, // Consider more candidates for better selection
      include: {
        game: {
          select: {
            id: true,
            variant: true,
            chess960Position: true,
          },
        },
      },
    });

    if (candidates.length === 0) {
      console.warn('No puzzle candidates available for daily puzzle');
      return null;
    }

    // Select a puzzle with weighted scoring:
    // - Higher rating = better
    // - More plays = better (but not required)
    // - More votes = better
    // - Random selection from top candidates to avoid always picking the same puzzle
    const scored = candidates.map((p: any) => ({
      puzzle: p,
      score: (p.rating / 100) + (p.plays * 0.1) + (p.votes * 5),
    }));

    scored.sort((a: any, b: any) => b.score - a.score);
    
    // Select randomly from top 10 candidates to add variety
    const topCandidates = scored.slice(0, Math.min(10, scored.length));
    const randomIndex = Math.floor(Math.random() * topCandidates.length);
    const selected = topCandidates[randomIndex].puzzle;

    // Mark this puzzle as today's daily puzzle (use UTC date to avoid timezone issues)
    const utcDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0));
    await (db as any).puzzle.update({
      where: { id: selected.id },
      data: { day: utcDay },
    });

    return {
      id: selected.id,
      gameId: selected.gameId,
      fen: selected.fen,
      solution: selected.solution,
      moves: selected.moves,
      rating: selected.rating,
    };
  } catch (error) {
    console.error('Error selecting new daily puzzle:', error);
    return null;
  }
}

/**
 * Clear the daily puzzle cache (useful for testing or manual refresh).
 */
export function clearDailyPuzzleCache(): void {
  cachedPuzzle = null;
  cacheTimestamp = 0;
}

