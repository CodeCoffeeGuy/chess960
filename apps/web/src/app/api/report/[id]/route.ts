import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@chess960/db';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Update report status (admin/mod only)
 * PATCH /api/report/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const { status, resolution } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'ESCALATED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Find report
    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Update report
    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status,
        resolution: resolution || null,
        reviewedBy: status !== 'PENDING' ? session.user.id : null,
        reviewedAt: status !== 'PENDING' ? new Date() : null,
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

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

