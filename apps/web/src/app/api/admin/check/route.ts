import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Check if current user is admin
 * GET /api/admin/check
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    
    return NextResponse.json({ 
      isAdmin: !!admin,
      user: admin ? { id: admin.id, handle: admin.handle } : null
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}



