import { db } from '../src';

async function checkTables() {
  try {
    // Try to query practice table directly
    const result = await db.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'practice%'
      ORDER BY table_name;
    `;
    
    console.log('\n📋 Practice-related tables in database:');
    console.log(result);
    
    // Try to count practices
    try {
      const count = await (db as any).practice.count();
      console.log(`\n✓ Practices table exists with ${count} practices\n`);
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.log('\n✗ Practices table does NOT exist in database\n');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await db.$disconnect();
  }
}

checkTables();

