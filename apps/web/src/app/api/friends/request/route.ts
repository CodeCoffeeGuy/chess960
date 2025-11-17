import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';
import { broadcastNotificationToUser } from '@/lib/notification-broadcast';

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

    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 });
    }

    // Check if user is blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: userId },
          { blockerId: userId, blockedId: session.user.id },
        ],
      },
    });

    if (isBlocked) {
      return NextResponse.json({ error: 'Cannot send friend request to this user' }, { status: 403 });
    }

    // Check if target user exists and allows friend requests
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, allowFriendRequests: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!targetUser.allowFriendRequests) {
      return NextResponse.json({ error: 'This user is not accepting friend requests' }, { status: 403 });
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { user1Id: session.user.id, user2Id: userId },
          { user1Id: userId, user2Id: session.user.id },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json({ error: 'Already friends' }, { status: 400 });
    }

    // Check if friend request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: userId, status: 'PENDING' },
          { senderId: userId, receiverId: session.user.id, status: 'PENDING' },
        ],
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'Friend request already exists' }, { status: 400 });
    }

    // Create friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: session.user.id,
        receiverId: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            handle: true,
            fullName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            handle: true,
            fullName: true,
          },
        },
      },
    });

    // Check if receiver wants friend request notifications
    const receiverSettings = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushNotifications: true },
    });

    // Create notification for the receiver only if they want push notifications
    if (receiverSettings?.pushNotifications !== false) {
      const notification = await prisma.notification.create({
        data: {
          userId: userId,
          type: 'FRIEND_REQUEST',
          title: 'Friend Request',
          message: `${friendRequest.sender.handle} sent you a friend request`,
          friendRequestId: friendRequest.id,
          link: '/friends',
        },
      });

      // Broadcast notification in real-time
      await broadcastNotificationToUser(userId, notification.id);
    }

    return NextResponse.json({ success: true, friendRequest });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json(
      { error: 'Failed to send friend request' },
      { status: 500 }
    );
  }
}
