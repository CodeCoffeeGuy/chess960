import { getServerSession } from 'next-auth';
import { prisma } from '@chess960/db';

/**
 * Check if the current user is an admin
 * Returns the user if admin, null otherwise
 */
export async function requireAdmin() {
  // Dynamic import to avoid circular dependency issues
  const { authOptions } = await import('@/app/api/auth/[...nextauth]/route');
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, handle: true, isAdmin: true },
  });

  if (!user || !user.isAdmin) {
    return null;
  }

  return user;
}

/**
 * Check if the current user is an admin (client-side)
 * This should be used with caution and verified server-side
 */
export async function checkAdminStatus(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/check');
    if (response.ok) {
      const data = await response.json();
      return data.isAdmin === true;
    }
    return false;
  } catch {
    return false;
  }
}


