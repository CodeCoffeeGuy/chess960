import { NextRequest, NextResponse } from 'next/server';
import { db } from '@chess960/db';
import { getChess960Position } from '@chess960/utils';

// Force Node.js runtime for Prisma and ensure dynamic rendering
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get 2 featured games with highest combined ratings
    // Priority: bullet/blitz games with high ratings, but fall back to any live game
    const liveGames = await db.game.findMany({
      where: {
        startedAt: { not: null },
        endedAt: null,
      },
      include: {
        white: {
          select: {
            id: true,
            handle: true,
          },
        },
        black: {
          select: {
            id: true,
            handle: true,
          },
        },
        moves: {
          orderBy: { ply: 'asc' },
          select: { uci: true, ply: true },
        },
        _count: {
          select: {
            moves: true,
            spectators: true,
          },
        },
      },
      take: 20, // Get more to sort by combined rating
    });

    // Calculate combined rating and sort
    // Prioritize bullet/blitz games, then by rating
    const gamesWithRatings = liveGames
      .map((game) => ({
        ...game,
        combinedRating: (game.whiteRatingBefore || 1500) + (game.blackRatingBefore || 1500),
        isPriority: game.tc === 'ONE_PLUS_ZERO' || game.tc === 'TWO_PLUS_ZERO', // Bullet or blitz
      }))
      .sort((a, b) => {
        // First sort by priority (bullet/blitz first)
        if (a.isPriority !== b.isPriority) {
          return a.isPriority ? -1 : 1;
        }
        // Then by combined rating
        return b.combinedRating - a.combinedRating;
      })
      .slice(0, 2); // Take top 2

    const formattedGames = gamesWithRatings.map((game) => {
      // Compute initialFen for Chess960 games
      let initialFen: string | undefined;
      if (game.variant === 'CHESS960' && game.chess960Position) {
        try {
          const chess960Pos = getChess960Position(game.chess960Position);
          initialFen = chess960Pos.fen;
        } catch (error) {
          console.error('Error computing Chess960 FEN:', error);
        }
      }

      return {
        id: game.id,
        whiteId: game.whiteId,
        blackId: game.blackId,
        whiteHandle: game.white?.handle || 'Anonymous',
        blackHandle: game.black?.handle || 'Anonymous',
        whiteRating: game.whiteRatingBefore || 1500,
        blackRating: game.blackRatingBefore || 1500,
        tc: game.tc === 'ONE_PLUS_ZERO' ? '1+0' : game.tc === 'TWO_PLUS_ZERO' ? '2+0' : game.tc === 'FIVE_PLUS_ZERO' ? '5+0' : game.tc === 'TEN_PLUS_ZERO' ? '10+0' : game.tc || 'N/A',
        variant: game.variant,
        chess960Position: game.chess960Position,
        initialFen,
        rated: game.rated,
        startedAt: game.startedAt?.toISOString() || null,
        moves: game.moves.map((m) => m.uci),
        moveCount: game._count.moves,
        spectatorCount: game._count.spectators,
        combinedRating: game.combinedRating,
      };
    });

    // Return response with cache control to ensure fresh data
    const response = NextResponse.json({ games: formattedGames });
    response.headers.set('Cache-Control', 'no-store, must-revalidate, max-age=0');
    return response;
  } catch (error) {
    console.error('Error fetching featured games:', error);
    
    // Always return a valid response, even on error
    // This ensures the component can render placeholders
    return NextResponse.json(
      { 
        games: [],
        error: 'Failed to fetch featured games'
      },
      { 
        status: 500,
        // Ensure no caching of error responses
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        }
      }
    );
  }
}

