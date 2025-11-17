import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';
import { broadcastNotificationToUser } from '@/lib/notification-broadcast';
import { sendChallengeNotification } from '@/lib/push-notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receiverId, tc, rated } = await request.json();

    if (!receiverId || !tc) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Cannot challenge yourself
    if (receiverId === session.user.id) {
      return NextResponse.json({ error: 'You cannot challenge yourself' }, { status: 400 });
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
      return NextResponse.json({ error: 'Cannot challenge this user' }, { status: 403 });
    }

    // Use unified BULLET rating for all bullet games
    const ratingTc = 'BULLET';

    // Get receiver's profile with ratings
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: {
        id: true,
        handle: true,
        allowChallenges: true,
        email: true,
        ratings: {
          where: { tc: ratingTc },
          select: { rating: true, rd: true },
        },
      },
    });

    if (!receiver) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if receiver allows challenges
    if (receiver.allowChallenges === 'NEVER') {
      return NextResponse.json(
        { error: 'This user is not accepting challenges' },
        { status: 403 }
      );
    }

    // Get sender's rating (using unified BULLET rating)
    const senderRating = await prisma.rating.findUnique({
      where: {
        userId_tc_variant: {
          userId: session.user.id,
          tc: ratingTc,
          variant: 'CHESS960',
        },
      },
      select: { rating: true },
    });

    // Check rating range restriction
    if (receiver.allowChallenges === 'RATING_RANGE') {
      const receiverRating = receiver.ratings[0]?.rating || 1500;
      const senderRatingValue = senderRating?.rating || 1500;
      const ratingDiff = Math.abs(Number(receiverRating) - Number(senderRatingValue));

      if (ratingDiff > 200) {
        return NextResponse.json(
          { error: 'Rating difference is too large (must be within ±200)' },
          { status: 403 }
        );
      }
    }

    // Check if friends only
    if (receiver.allowChallenges === 'FRIENDS_ONLY') {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { user1Id: session.user.id, user2Id: receiverId },
            { user1Id: receiverId, user2Id: session.user.id },
          ],
        },
      });

      if (!friendship) {
        return NextResponse.json(
          { error: 'This user only accepts challenges from friends' },
          { status: 403 }
        );
      }
    }

    // Check if registered users only
    if (receiver.allowChallenges === 'REGISTERED') {
      const sender = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });

      if (!sender?.email) {
        return NextResponse.json(
          { error: 'This user only accepts challenges from registered users' },
          { status: 403 }
        );
      }
    }

    // Check if there's already a pending challenge between these users
    const existingChallenge = await prisma.challenge.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId, status: 'PENDING' },
          { senderId: receiverId, receiverId: session.user.id, status: 'PENDING' },
        ],
      },
    });

    if (existingChallenge) {
      return NextResponse.json(
        { error: 'There is already a pending challenge between you and this user' },
        { status: 400 }
      );
    }

    // Create the challenge (expires in 2 minutes)
    const challenge = await prisma.challenge.create({
      data: {
        senderId: session.user.id,
        receiverId,
        tc,
        rated: rated ?? true,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
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
          },
        },
      },
    });

    // Check if receiver wants game notifications
    const receiverSettings = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { gameNotifications: true },
    });

    // Create notification for the receiver only if they want game notifications
    if (receiverSettings?.gameNotifications !== false) {
      const notification = await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'CHALLENGE',
          title: 'New Challenge!',
          message: `${challenge.sender.handle} challenges you to a ${tc} ${rated ? 'rated' : 'unrated'} game`,
          challengeId: challenge.id,
          link: '/play',
        },
      });

      // Broadcast notification in real-time
      await broadcastNotificationToUser(receiverId, notification.id);

      // Send push notification
      try {
        const challengerName = challenge.sender.fullName || challenge.sender.handle;
        const timeControl = `${tc} ${rated ? 'rated' : 'unrated'}`;
        await sendChallengeNotification(receiverId, challengerName, timeControl);
      } catch (error) {
        console.error('Failed to send push notification for challenge:', error);
        // Don't fail the challenge if push notification fails
      }
    }

    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    console.error('Send challenge error:', error);
    return NextResponse.json(
      { error: 'Failed to send challenge' },
      { status: 500 }
    );
  }
}
