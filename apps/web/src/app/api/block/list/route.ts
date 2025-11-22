import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

/**
 * Get list of blocked users
 * GET /api/block/list
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocks = await prisma.block.findMany({
      where: {
        blockerId: session.user.id,
      },
      include: {
        blocked: {
          select: {
            id: true,
            handle: true,
            fullName: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const blockedUsers = blocks.map(block => ({
      id: block.blocked.id,
      handle: block.blocked.handle,
      fullName: block.blocked.fullName,
      image: block.blocked.image,
      blockedAt: block.createdAt,
    }));

    return NextResponse.json({ blockedUsers });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blocked users' },
      { status: 500 }
    );
  }
}



