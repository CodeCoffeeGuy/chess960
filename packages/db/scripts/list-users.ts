import { db } from '../src';

/**
 * List all users in the database
 */
async function listUsers() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        handle: true,
        name: true,
        fullName: true,
        isAdmin: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (users.length === 0) {
      console.log('No users found in database');
      return;
    }

    // Filter out guest users
    const registeredUsers = users.filter(u => !u.id.startsWith('guest_'));
    const guestUsers = users.filter(u => u.id.startsWith('guest_'));

    console.log(`\nFound ${users.length} total user(s):`);
    console.log(`  - ${registeredUsers.length} registered user(s)`);
    console.log(`  - ${guestUsers.length} guest user(s)\n`);

    if (registeredUsers.length > 0) {
      console.log('REGISTERED USERS:');
      console.log('Email'.padEnd(40), 'Handle'.padEnd(20), 'Verified'.padEnd(10), 'Admin'.padEnd(8), 'ID');
      console.log('-'.repeat(120));

      registeredUsers.forEach((user) => {
        const email = (user.email || '(no email)').padEnd(40);
        const handle = (user.handle || '(no handle)').padEnd(20);
        const verified = (user.emailVerified ? 'Yes' : 'No').padEnd(10);
        const admin = (user.isAdmin ? 'Yes' : 'No').padEnd(8);
        console.log(email, handle, verified, admin, user.id);
      });
      console.log('\n');
    }

    if (guestUsers.length > 0 && process.argv.includes('--show-guests')) {
      console.log('GUEST USERS (first 10):');
      console.log('Handle'.padEnd(20), 'ID');
      console.log('-'.repeat(60));
      guestUsers.slice(0, 10).forEach((user) => {
        const handle = (user.handle || '').padEnd(20);
        console.log(handle, user.id);
      });
      console.log('\n');
    }

    console.log('\n');
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

listUsers();

