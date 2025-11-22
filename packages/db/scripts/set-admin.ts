import { db } from '../src';

/**
 * Set a user as admin by email, handle, or user ID
 * Usage: npx tsx scripts/set-admin.ts <email|handle|userId>
 */
async function setAdmin(identifier: string) {
  try {
    // Try to find user by ID first (if it looks like a UUID or CUID)
    let user = null;
    
    // Check if it's a user ID (UUID or CUID format)
    if (identifier.length > 20 || identifier.includes('-')) {
      user = await db.user.findUnique({
        where: { id: identifier },
      });
    }
    
    // If not found by ID, try email or handle
    if (!user) {
      user = await db.user.findFirst({
        where: {
          OR: [
            { email: identifier },
            { handle: identifier },
          ],
        },
      });
    }

    if (!user) {
      console.error(`❌ User not found: ${identifier}`);
      console.error('\n💡 Tip: Run "npx tsx scripts/list-users.ts" to see all users');
      process.exit(1);
    }

    // Set as admin
    await db.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    });

    console.log(`✅ User ${user.handle || user.email} (${user.id}) is now an admin`);
  } catch (error) {
    console.error('Error setting admin:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.error('Usage: npx tsx scripts/set-admin.ts <email|handle>');
  process.exit(1);
}

setAdmin(identifier);


