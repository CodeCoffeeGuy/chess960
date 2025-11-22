import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@chess960/db';
import { getAuthService } from '@chess960/utils';
import { getOrCreatePuzzleRating } from '@/lib/puzzle-rating-service';

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url);
    const theme = searchParams.get('theme');
    const color = searchParams.get('color') as 'white' | 'black' | 'random' | null;
    const difficulty = parseInt(searchParams.get('difficulty') || '0', 10);

    if (!theme) {
      return NextResponse.json({ error: 'Theme required' }, { status: 400 });
    }

    console.log(`[Puzzle by Theme] Searching for puzzle with theme: ${theme}`);

    // Get user rating for difficulty adjustment
    let targetRating = 1500;
    if (userId) {
      try {
        const userRating = await getOrCreatePuzzleRating(userId);
        targetRating = Math.round(userRating.rating) + difficulty;
      } catch (error) {
        console.error('Error getting user rating:', error);
      }
    }

    const ratingRange = 100;

    // Build query
    const where: any = {
      themes: {
        has: theme,
      },
      rating: {
        gte: targetRating - ratingRange,
        lte: targetRating + ratingRange,
      },
    };

    // Filter by color if specified
    if (color && color !== 'random') {
      // This would require analyzing the puzzle FEN to determine whose turn it is
      // For now, we'll skip color filtering as it requires additional logic
    }

    // Exclude already solved puzzles if user is logged in
    if (userId) {
      where.rounds = {
        none: {
          userId,
        },
      };
    }

    // Try to find puzzle with the specific theme
    // First, get all puzzles with this theme
    console.log(`[Puzzle by Theme] Query where clause:`, JSON.stringify(where, null, 2));
    
    const puzzlesWithTheme = await (db as any).puzzle.findMany({
      where,
      include: {
        game: {
          select: {
            variant: true,
            chess960Position: true,
          },
        },
      },
    });

    console.log(`[Puzzle by Theme] Found ${puzzlesWithTheme.length} puzzles with theme "${theme}"`);

    // Select a random puzzle from the results
    let puzzle = puzzlesWithTheme.length > 0
      ? puzzlesWithTheme[Math.floor(Math.random() * puzzlesWithTheme.length)]
      : null;
    
    if (puzzle) {
      console.log(`[Puzzle by Theme] Selected puzzle ${puzzle.id} with themes: ${JSON.stringify(puzzle.themes)}`);
    }

    // If no puzzle found with theme, return 404 (don't use fallback)
    if (!puzzle) {
      console.log(`[Puzzle by Theme] No puzzle found with theme "${theme}"`);
      
      // Check how many puzzles have this theme
      const themeCount = await (db as any).puzzle.count({
        where: {
          themes: {
            has: theme,
          },
        },
      });
      console.log(`[Puzzle by Theme] Total puzzles with theme "${theme}": ${themeCount}`);
      
      return NextResponse.json(
        { 
          error: 'No puzzle found for this theme',
          message: `No puzzles available with theme "${theme}". Try a different theme or check back later.`,
          themeCount
        },
        { status: 404 }
      );
    }
    
    console.log(`[Puzzle by Theme] Found puzzle with theme "${theme}"`);

    if (!puzzle) {
      return NextResponse.json(
        { 
          error: 'No puzzle found for this theme',
          message: `No puzzles available with theme "${theme}". Try a different theme or check back later.`
        },
        { status: 404 }
      );
    }

    // Get initial FEN if Chess960
    const { getChess960Position } = await import('@chess960/utils');
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
    console.error('Error fetching puzzle by theme:', error);
    return NextResponse.json({ error: 'Failed to fetch puzzle' }, { status: 500 });
  }
}









