import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@chess960/db';

// Ensure Prisma client is initialized
if (!prisma) {
  console.error('[Opening API] Prisma client is not initialized!');
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/opening - Search openings
export async function GET(request: NextRequest) {
  console.log('[Opening API] ====== GET /api/opening called ======');
  console.log('[Opening API] Request URL:', request.url);
  
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q'); // Search query (name or position number)
    const moves = searchParams.get('moves'); // UCI moves separated by spaces
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log('[Opening API] Called with query:', query);
    console.log('[Opening API] Limit:', limit);

    const where: any = {};

    if (query) {
      // Check if query is a number (Chess960 position)
      const positionNum = parseInt(query);
      if (!isNaN(positionNum) && positionNum >= 1 && positionNum <= 960) {
        where.chess960Position = positionNum;
        console.log('[Opening API] Filtering by position:', positionNum);
      } else {
        // Search by name
        where.name = { contains: query, mode: 'insensitive' };
        console.log('[Opening API] Searching by name:', query);
      }
    }

    if (moves) {
      where.moves = moves.trim();
    }

    // Build orderBy clause
    // Use simple object for single field, array for multiple fields
    let orderBy: any;
    if (where.chess960Position) {
      // If filtering by position, sort by name only
      orderBy = { name: 'asc' };
    } else {
      // Otherwise sort by position first, then name
      // Simple array format - Prisma will handle nulls automatically
      orderBy = [
        { chess960Position: 'asc' },
        { name: 'asc' },
      ];
    }

    console.log('[Opening API] Where clause:', JSON.stringify(where));
    console.log('[Opening API] OrderBy:', JSON.stringify(orderBy));

    // Execute query - try with _count first, fallback without if needed
    let openings;
    try {
      console.log('[Opening API] Executing query with _count...');
      openings = await (prisma as any).opening.findMany({
        where,
        include: {
          _count: {
            select: {
              movesData: true,
              games: true,
            },
          },
        },
        orderBy,
        take: limit,
      });
      console.log('[Opening API] Success! Found', openings.length, 'openings');
    } catch (dbError: any) {
      console.error('[Opening API] Query with _count failed');
      console.error('[Opening API] Error:', dbError.message);
      console.error('[Opening API] Code:', dbError.code);
      
      // Fallback: try without _count
      console.log('[Opening API] Retrying without _count...');
      try {
        openings = await (prisma as any).opening.findMany({
          where,
          orderBy,
          take: limit,
        });
        // Manually set counts to 0
        openings = openings.map((o: any) => ({
          ...o,
          _count: { movesData: 0, games: 0 },
        }));
        console.log('[Opening API] Fallback success! Found', openings.length, 'openings');
      } catch (fallbackError: any) {
        console.error('[Opening API] Fallback also failed:', fallbackError.message);
        console.error('[Opening API] Fallback code:', fallbackError.code);
        throw fallbackError;
      }
    }

    return NextResponse.json({
      openings: openings.map((opening: any) => ({
        id: opening.id,
        name: opening.name,
        eco: opening.eco,
        moves: opening.moves,
        fen: opening.fen,
        chess960Position: opening.chess960Position,
        moveCount: opening._count.movesData,
        gameCount: opening._count.games,
        createdAt: opening.createdAt.toISOString(),
        updatedAt: opening.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Error searching openings:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: 'Failed to search openings',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

