import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';

/**
 * Block a user
 * POST /api/block
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Can't block yourself
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    // Check if user exists
    const userToBlock = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userToBlock) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already blocked
    const existingBlock = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: session.user.id,
          blockedId: userId,
        },
      },
    });

    if (existingBlock) {
      return NextResponse.json({ error: 'User is already blocked' }, { status: 400 });
    }

    // Create block
    const block = await prisma.block.create({
      data: {
        blockerId: session.user.id,
        blockedId: userId,
      },
    });

    // Also unfollow if following
    await prisma.follow.deleteMany({
      where: {
        followerId: session.user.id,
        followingId: userId,
      },
    });

    // Also remove from followers if they're following you
    await prisma.follow.deleteMany({
      where: {
        followerId: userId,
        followingId: session.user.id,
      },
    });

    // Cancel any pending challenges
    await prisma.challenge.updateMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: userId, status: 'PENDING' },
          { senderId: userId, receiverId: session.user.id, status: 'PENDING' },
        ],
      },
      data: {
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({ success: true, block });
  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json(
      { error: 'Failed to block user' },
      { status: 500 }
    );
  }
}

/**
 * Unblock a user
 * DELETE /api/block
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if block exists
    const block = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: session.user.id,
          blockedId: userId,
        },
      },
    });

    if (!block) {
      return NextResponse.json({ error: 'User is not blocked' }, { status: 400 });
    }

    // Delete block
    await prisma.block.delete({
      where: {
        id: block.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json(
      { error: 'Failed to unblock user' },
      { status: 500 }
    );
  }
}

/**
 * Check if a user is blocked
 * GET /api/block?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Check if current user has blocked this user
    const isBlocked = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: session.user.id,
          blockedId: userId,
        },
      },
    });

    // Check if this user has blocked current user
    const isBlockedBy = await prisma.block.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: userId,
          blockedId: session.user.id,
        },
      },
    });

    return NextResponse.json({
      isBlocked: !!isBlocked,
      isBlockedBy: !!isBlockedBy,
    });
  } catch (error) {
    console.error('Error checking block status:', error);
    return NextResponse.json(
      { error: 'Failed to check block status' },
      { status: 500 }
    );
  }
}



