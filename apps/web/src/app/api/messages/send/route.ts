import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';
import { sendMessageNotification } from '@/lib/push-notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receiverId, content } = await request.json();

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'Receiver ID and content are required' }, { status: 400 });
    }

    if (content.trim().length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });
    }

    // Check if receiver exists and allows messages
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, allowMessages: true },
    });

    if (!receiver) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!receiver.allowMessages) {
      return NextResponse.json({ error: 'This user is not accepting messages' }, { status: 403 });
    }

    // Check if user is blocked
    const isBlocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: receiverId },
          { blockerId: receiverId, blockedId: session.user.id },
        ],
      },
    });

    if (isBlocked) {
      return NextResponse.json({ error: 'Cannot message this user' }, { status: 403 });
    }

    // Check if user is following the receiver
    const isFollowing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.user.id,
          followingId: receiverId,
        },
      },
    });

    if (!isFollowing) {
      return NextResponse.json({ error: 'You can only message users you follow' }, { status: 403 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        receiverId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            handle: true,
            fullName: true,
            image: true,
          },
        },
        receiver: {
          select: {
            id: true,
            handle: true,
            fullName: true,
            image: true,
          },
        },
      },
    });

    // Send push notification to receiver
    try {
      const senderName = message.sender.fullName || message.sender.handle;
      const messagePreview = content.length > 50 ? content.substring(0, 50) + '...' : content;
      await sendMessageNotification(receiverId, senderName, messagePreview);
    } catch (error) {
      console.error('Failed to send push notification for message:', error);
      // Don't fail the message send if push notification fails
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
