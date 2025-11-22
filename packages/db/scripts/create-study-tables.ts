import { db } from '../src';

async function createStudyTables() {
  console.log('Creating study tables...');
  try {
    // Create studies table
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "studies" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "owner_id" TEXT NOT NULL,
        "is_public" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        "likes" INTEGER NOT NULL DEFAULT 0,
        "views" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "studies_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created studies table');

    // Create study_chapters table
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "study_chapters" (
        "id" TEXT NOT NULL,
        "study_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "order" INTEGER NOT NULL DEFAULT 0,
        "initial_fen" TEXT NOT NULL,
        "pgn" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "study_chapters_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created study_chapters table');

    // Create study_comments table
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "study_comments" (
        "id" TEXT NOT NULL,
        "study_id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "move_ply" INTEGER,
        "text" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "study_comments_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created study_comments table');

    // Create study_likes table
    await (db as any).$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "study_likes" (
        "id" TEXT NOT NULL,
        "study_id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "study_likes_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created study_likes table');

    // Create indexes
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "studies_owner_id_idx" ON "studies"("owner_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "studies_is_public_created_at_idx" ON "studies"("is_public", "created_at");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "study_chapters_study_id_order_idx" ON "study_chapters"("study_id", "order");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "study_comments_study_id_idx" ON "study_comments"("study_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "study_comments_user_id_idx" ON "study_comments"("user_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "study_likes_study_id_user_id_key" 
      ON "study_likes"("study_id", "user_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "study_likes_study_id_idx" ON "study_likes"("study_id");
    `);
    await (db as any).$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "study_likes_user_id_idx" ON "study_likes"("user_id");
    `);
    console.log('Created indexes');

    // Add foreign key constraints
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'studies_owner_id_fkey'
        ) THEN
          ALTER TABLE "studies" 
          ADD CONSTRAINT "studies_owner_id_fkey" 
          FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'study_chapters_study_id_fkey'
        ) THEN
          ALTER TABLE "study_chapters" 
          ADD CONSTRAINT "study_chapters_study_id_fkey" 
          FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'study_comments_study_id_fkey'
        ) THEN
          ALTER TABLE "study_comments" 
          ADD CONSTRAINT "study_comments_study_id_fkey" 
          FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'study_comments_user_id_fkey'
        ) THEN
          ALTER TABLE "study_comments" 
          ADD CONSTRAINT "study_comments_user_id_fkey" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'study_likes_study_id_fkey'
        ) THEN
          ALTER TABLE "study_likes" 
          ADD CONSTRAINT "study_likes_study_id_fkey" 
          FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await (db as any).$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'study_likes_user_id_fkey'
        ) THEN
          ALTER TABLE "study_likes" 
          ADD CONSTRAINT "study_likes_user_id_fkey" 
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    console.log('Created foreign key constraints');

    console.log('\nStudy tables created successfully!');
  } catch (error: any) {
    console.error('Error creating study tables:', error.message);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

createStudyTables();

