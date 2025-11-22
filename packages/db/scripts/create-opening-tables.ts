import { db } from '../src';
import fs from 'fs';
import path from 'path';

async function createOpeningTables() {
  console.log('Creating opening tables...');
  try {
    const migrationPath = path.join(__dirname, '../prisma/migrations/20250119000000_add_study_practice_opening_models/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // First create tables
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE "openings"') ||
          statement.includes('CREATE TABLE "opening_moves"') ||
          statement.includes('CREATE TABLE "opening_games"')) {
        try {
          await (db as any).$executeRawUnsafe(statement);
          console.log(`Created table: ${statement.split('\n')[0].substring(0, 60)}...`);
        } catch (error: any) {
          if (!error.message.includes('already exists')) {
            console.error(`Error creating table: ${error.message}`);
          }
        }
      }
    }

    // Add chess960Position column before creating indexes
    try {
      await (db as any).$executeRawUnsafe(`
        ALTER TABLE "openings" 
        ADD COLUMN IF NOT EXISTS "chess960_position" INTEGER;
      `);
      console.log('Added chess960_position column');
    } catch (error: any) {
      if (!error.message.includes('does not exist')) {
        console.error('Error adding chess960Position column:', error.message);
      }
    }

    // Then create indexes and constraints
    for (const statement of statements) {
      if (statement.includes('CREATE INDEX "openings_') ||
          statement.includes('CREATE UNIQUE INDEX "openings_') ||
          statement.includes('CREATE INDEX "opening_moves_') ||
          statement.includes('CREATE UNIQUE INDEX "opening_moves_') ||
          statement.includes('CREATE INDEX "opening_games_') ||
          statement.includes('CREATE UNIQUE INDEX "opening_games_') ||
          statement.includes('ALTER TABLE "opening_moves" ADD CONSTRAINT') ||
          statement.includes('ALTER TABLE "opening_games" ADD CONSTRAINT')) {
        try {
          // Skip the old unique constraint on moves only
          if (statement.includes('UNIQUE INDEX "openings_moves_key"')) {
            continue;
          }
          await (db as any).$executeRawUnsafe(statement);
          console.log(`Created index/constraint: ${statement.split('\n')[0].substring(0, 60)}...`);
        } catch (error: any) {
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.error(`Error creating index: ${error.message}`);
          }
        }
      }
    }

    // Create index for chess960Position
    try {
      await (db as any).$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "openings_chess960_position_idx" 
        ON "openings"("chess960_position");
      `);
      console.log('Created index for chess960_position');
    } catch (error: any) {
      if (!error.message.includes('does not exist')) {
        console.error('Error creating chess960Position index:', error.message);
      }
    }

    // Update unique constraint to include chess960Position
    // First drop old constraint if exists
    try {
      await (db as any).$executeRawUnsafe(`
        ALTER TABLE "openings" 
        DROP CONSTRAINT IF EXISTS "openings_moves_key";
      `);
      console.log('Dropped old unique constraint on moves');
    } catch (e: any) {
      // Ignore if constraint doesn't exist
      if (!e.message.includes('does not exist')) {
        console.log('Old constraint already removed or never existed');
      }
    }

    // Create new unique constraint
    try {
      await (db as any).$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "openings_moves_chess960_position_key" 
        ON "openings"("moves", "chess960_position");
      `);
      console.log('Created unique constraint for moves + chess960_position');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.error('Error creating unique constraint:', e.message);
      }
    }

    console.log('\nOpening tables created successfully!');
  } catch (error) {
    console.error('Error creating opening tables:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

createOpeningTables();

