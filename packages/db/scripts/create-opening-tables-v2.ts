import { db } from '../src';

async function createOpeningTables() {
  console.log('Creating opening tables...');
  try {
    // Create openings table with chess960Position
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "openings" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "eco" TEXT,
        "moves" TEXT NOT NULL,
        "fen" TEXT NOT NULL,
        "chess960_position" INTEGER,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "openings_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created openings table');

    // Create opening_moves table
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "opening_moves" (
        "id" TEXT NOT NULL,
        "opening_id" TEXT NOT NULL,
        "move" TEXT NOT NULL,
        "move_number" INTEGER NOT NULL,
        "games_played" INTEGER NOT NULL DEFAULT 0,
        "games_won" INTEGER NOT NULL DEFAULT 0,
        "games_drawn" INTEGER NOT NULL DEFAULT 0,
        "games_lost" INTEGER NOT NULL DEFAULT 0,
        "avg_rating" DECIMAL(10,2),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "opening_moves_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created opening_moves table');

    // Create opening_games table
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "opening_games" (
        "id" TEXT NOT NULL,
        "opening_id" TEXT NOT NULL,
        "game_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "opening_games_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created opening_games table');

    // Create indexes
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "openings_eco_idx" ON "openings"("eco");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "openings_name_idx" ON "openings"("name");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "openings_chess960_position_idx" ON "openings"("chess960_position");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "openings_moves_chess960_position_key" 
      ON "openings"("moves", "chess960_position");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "opening_moves_opening_id_move_key" 
      ON "opening_moves"("opening_id", "move");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "opening_moves_opening_id_move_number_idx" 
      ON "opening_moves"("opening_id", "move_number");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "opening_games_opening_id_game_id_key" 
      ON "opening_games"("opening_id", "game_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "opening_games_opening_id_idx" ON "opening_games"("opening_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "opening_games_game_id_idx" ON "opening_games"("game_id");
    `);
    console.log('Created indexes');

    // Add foreign key constraints
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'opening_moves_opening_id_fkey'
        ) THEN
          ALTER TABLE "opening_moves" 
          ADD CONSTRAINT "opening_moves_opening_id_fkey" 
          FOREIGN KEY ("opening_id") REFERENCES "openings"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'opening_games_opening_id_fkey'
        ) THEN
          ALTER TABLE "opening_games" 
          ADD CONSTRAINT "opening_games_opening_id_fkey" 
          FOREIGN KEY ("opening_id") REFERENCES "openings"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'opening_games_game_id_fkey'
        ) THEN
          ALTER TABLE "opening_games" 
          ADD CONSTRAINT "opening_games_game_id_fkey" 
          FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    console.log('Created foreign key constraints');

    console.log('\nOpening tables created successfully!');
  } catch (error: any) {
    console.error('Error creating opening tables:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

createOpeningTables();

