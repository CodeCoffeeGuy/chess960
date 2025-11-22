import { db } from '../src';

async function createPracticeTables() {
  try {
    console.log('📋 Creating practice tables...\n');
    
    // Create enums if they don't exist
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE practice_category AS ENUM ('OPENING', 'MIDDLEGAME', 'ENDGAME', 'TACTICS', 'STRATEGY', 'CHECKMATE');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✓ Created practice_category enum');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ practice_category enum already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE practice_difficulty AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✓ Created practice_difficulty enum');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ practice_difficulty enum already exists');
      } else {
        throw error;
      }
    }
    
    // Create practices table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS practices (
        id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category practice_category NOT NULL,
        difficulty practice_difficulty NOT NULL DEFAULT 'BEGINNER',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL,
        CONSTRAINT practices_pkey PRIMARY KEY (id)
      );
    `);
    console.log('✓ Created practices table');
    
    // Create practice_lessons table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS practice_lessons (
        id TEXT NOT NULL,
        practice_id TEXT NOT NULL,
        title TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        initial_fen TEXT NOT NULL,
        instructions TEXT NOT NULL,
        solution TEXT,
        hints TEXT[],
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(3) NOT NULL,
        CONSTRAINT practice_lessons_pkey PRIMARY KEY (id)
      );
    `);
    console.log('✓ Created practice_lessons table');
    
    // Create practice_completions table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS practice_completions (
        id TEXT NOT NULL,
        practice_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        completed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        score INTEGER,
        CONSTRAINT practice_completions_pkey PRIMARY KEY (id)
      );
    `);
    console.log('✓ Created practice_completions table');
    
    // Create indexes
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS practices_category_difficulty_idx ON practices(category, difficulty);
    `);
    console.log('✓ Created practices index');
    
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS practice_lessons_practice_id_order_idx ON practice_lessons(practice_id, "order");
    `);
    console.log('✓ Created practice_lessons index');
    
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS practice_completions_practice_id_user_id_key ON practice_completions(practice_id, user_id);
    `);
    console.log('✓ Created practice_completions unique index');
    
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS practice_completions_user_id_idx ON practice_completions(user_id);
    `);
    console.log('✓ Created practice_completions user_id index');
    
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS practice_completions_practice_id_idx ON practice_completions(practice_id);
    `);
    console.log('✓ Created practice_completions practice_id index');
    
    // Add foreign keys if they don't exist
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE practice_lessons ADD CONSTRAINT practice_lessons_practice_id_fkey 
            FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✓ Added practice_lessons foreign key');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ practice_lessons foreign key already exists');
      }
    }
    
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE practice_completions ADD CONSTRAINT practice_completions_practice_id_fkey 
            FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✓ Added practice_completions practice_id foreign key');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ practice_completions practice_id foreign key already exists');
      }
    }
    
    try {
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          ALTER TABLE practice_completions ADD CONSTRAINT practice_completions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log('✓ Added practice_completions user_id foreign key');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠ practice_completions user_id foreign key already exists');
      }
    }
    
    console.log('\n✅ Practice tables created successfully!\n');
    
    // Verify
    const count = await (db as any).practice.count();
    console.log(`📊 Practices in database: ${count}\n`);
    
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

createPracticeTables();

