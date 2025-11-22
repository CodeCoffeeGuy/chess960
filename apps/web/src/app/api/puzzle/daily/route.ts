import { NextRequest, NextResponse } from 'next/server';
import { getDailyPuzzle } from '@/lib/daily-puzzle-service';
import { getChess960Position } from '@chess960/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const puzzle = await getDailyPuzzle();

    if (!puzzle) {
      // Log for debugging
      console.warn('[Daily Puzzle API] No puzzle returned from getDailyPuzzle()');
      // Return 200 with null puzzle instead of 404 - this is expected when no puzzles exist yet
      return NextResponse.json(
        { 
          puzzle: null,
          error: 'No puzzle available'
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
          }
        }
      );
    }

    // Get game details to include initial FEN for Chess960 and game info
    const { db } = await import('@chess960/db');
    const game = await (db as any).game.findUnique({
      where: { id: puzzle.gameId },
      select: {
        id: true,
        variant: true,
        chess960Position: true,
        tc: true,
        whiteId: true,
        blackId: true,
        whiteRatingBefore: true,
        blackRatingBefore: true,
        white: {
          select: {
            handle: true,
          },
        },
        black: {
          select: {
            handle: true,
          },
        },
      },
    });

    let initialFen: string | undefined;
    if (game?.variant === 'CHESS960' && game.chess960Position) {
      try {
        const chess960Pos = getChess960Position(game.chess960Position);
        initialFen = chess960Pos.fen;
      } catch (error) {
        console.error('Error computing Chess960 FEN for puzzle:', error);
      }
    }

    // Format game info
    const gameInfo = game ? {
      id: game.id,
      variant: game.variant,
      timeControl: game.tc,
      white: {
        handle: game.white?.handle || 'Anonymous',
        rating: game.whiteRatingBefore,
      },
      black: {
        handle: game.black?.handle || 'Anonymous',
        rating: game.blackRatingBefore,
      },
    } : null;

    const response = NextResponse.json({
      puzzle: {
        ...puzzle,
        initialFen,
        gameInfo,
      },
    });

    // Cache for 1 hour (puzzle changes daily, but cache helps with load)
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    
    return response;
  } catch (error) {
    console.error('Error fetching daily puzzle:', error);
    
    return NextResponse.json(
      { 
        puzzle: null,
        error: 'Failed to fetch daily puzzle'
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        }
      }
    );
  }
}

