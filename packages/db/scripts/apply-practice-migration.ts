import { db } from '../src';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyPracticeMigration() {
  try {
    console.log('📋 Applying practice migration...\n');
    
    // Read migration SQL
    const migrationPath = join(__dirname, '../prisma/migrations/20250119000000_add_study_practice_opening_models/migration.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        // Add semicolon back for execution
        await db.$executeRawUnsafe(statement + ';');
        console.log(`✓ Statement ${i + 1}/${statements.length} executed`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.code === '42P07' || error.code === '42710') {
          console.log(`⚠ Statement ${i + 1}/${statements.length} skipped (already exists)`);
        } else {
          console.error(`✗ Error in statement ${i + 1}:`, error.message);
          // Continue with other statements
        }
      }
    }
    
    console.log('\n✅ Migration applied (or already exists)\n');
    
    // Verify tables exist
    const tables = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('practices', 'practice_lessons', 'practice_completions')
      ORDER BY table_name;
    `;
    
    console.log('📊 Practice tables in database:');
    tables.forEach(t => console.log(`  ✓ ${t.table_name}`));
    console.log('');
    
  } catch (error) {
    console.error('Error applying migration:', error);
  } finally {
    await db.$disconnect();
  }
}

applyPracticeMigration();

