import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Create a report
 * POST /api/report
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reportedId, reason, description, gameId, messageId } = await request.json();

    if (!reportedId || !reason) {
      return NextResponse.json({ error: 'Reported user ID and reason are required' }, { status: 400 });
    }

    // Cannot report yourself
    if (reportedId === session.user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });
    }

    // Validate reason
    const validReasons = ['CHEATING', 'TOXIC_BEHAVIOR', 'SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'OTHER'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: 'Invalid report reason' }, { status: 400 });
    }

    // Check if reported user exists
    const reportedUser = await prisma.user.findUnique({
      where: { id: reportedId },
      select: { id: true },
    });

    if (!reportedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if there's already a pending report for this user by this reporter
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: session.user.id,
        reportedId,
        status: 'PENDING',
      },
    });

    if (existingReport) {
      return NextResponse.json({ error: 'You already have a pending report for this user' }, { status: 400 });
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        reporterId: session.user.id,
        reportedId,
        reason,
        description: description?.trim() || null,
        gameId: gameId || null,
        messageId: messageId || null,
        status: 'PENDING',
      },
      include: {
        reporter: {
          select: {
            id: true,
            handle: true,
          },
        },
        reported: {
          select: {
            id: true,
            handle: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json(
      { error: 'Failed to create report' },
      { status: 500 }
    );
  }
}

/**
 * Get reports (admin/mod only)
 * GET /api/report?status=PENDING&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (for viewing all reports)
    const admin = await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as any;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const myReports = searchParams.get('myReports') === 'true';

    const where: any = {};
    
    // If not admin, only show their own reports
    if (!admin) {
      where.reporterId = session.user.id;
    } else if (myReports) {
      // Admin can filter to their own reports if requested
      where.reporterId = session.user.id;
    }
    
    if (status && status !== '' && ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'ESCALATED'].includes(status)) {
      where.status = status;
    }

    const reports = await prisma.report.findMany({
      where,
      include: {
        reporter: {
          select: {
            id: true,
            handle: true,
            fullName: true,
          },
        },
        reported: {
          select: {
            id: true,
            handle: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

