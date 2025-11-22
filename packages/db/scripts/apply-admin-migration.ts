import { db } from '../src';

/**
 * Apply the admin role migration directly
 * This adds the is_admin column to the users table
 */
async function applyMigration() {
  try {
    console.log('🔄 Applying admin role migration...');

    // Check if column already exists
    const checkResult = await db.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `;

    if (checkResult.length > 0) {
      console.log('✅ Column is_admin already exists');
      return;
    }

    // Add the column
    await db.$executeRaw`
      ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;
    `;

    console.log('✅ Added is_admin column');

    // Create index
    try {
      await db.$executeRaw`
        CREATE INDEX "users_is_admin_idx" ON "users"("is_admin");
      `;
      console.log('✅ Created index on is_admin');
    } catch (error: any) {
      // Index might already exist, that's okay
      if (error?.code !== '42P07') {
        throw error;
      }
      console.log('ℹ️  Index already exists');
    }

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

applyMigration();


