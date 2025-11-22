-- CreateEnum
CREATE TYPE "practice_category" AS ENUM ('OPENING', 'MIDDLEGAME', 'ENDGAME', 'TACTICS', 'STRATEGY', 'CHECKMATE');

-- CreateEnum
CREATE TYPE "practice_difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateTable
CREATE TABLE "studies" (
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

-- CreateTable
CREATE TABLE "study_chapters" (
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

-- CreateTable
CREATE TABLE "study_comments" (
    "id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "move_ply" INTEGER,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_likes" (
    "id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practices" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "practice_category" NOT NULL,
    "difficulty" "practice_difficulty" NOT NULL DEFAULT 'BEGINNER',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_lessons" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "initial_fen" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "solution" TEXT,
    "hints" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_completions" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" INTEGER,

    CONSTRAINT "practice_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eco" TEXT,
    "moves" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_moves" (
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

-- CreateTable
CREATE TABLE "opening_games" (
    "id" TEXT NOT NULL,
    "opening_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opening_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studies_owner_id_idx" ON "studies"("owner_id");

-- CreateIndex
CREATE INDEX "studies_is_public_created_at_idx" ON "studies"("is_public", "created_at");

-- CreateIndex
CREATE INDEX "study_chapters_study_id_order_idx" ON "study_chapters"("study_id", "order");

-- CreateIndex
CREATE INDEX "study_comments_study_id_idx" ON "study_comments"("study_id");

-- CreateIndex
CREATE INDEX "study_comments_user_id_idx" ON "study_comments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_likes_study_id_user_id_key" ON "study_likes"("study_id", "user_id");

-- CreateIndex
CREATE INDEX "study_likes_study_id_idx" ON "study_likes"("study_id");

-- CreateIndex
CREATE INDEX "study_likes_user_id_idx" ON "study_likes"("user_id");

-- CreateIndex
CREATE INDEX "practices_category_difficulty_idx" ON "practices"("category", "difficulty");

-- CreateIndex
CREATE INDEX "practice_lessons_practice_id_order_idx" ON "practice_lessons"("practice_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "practice_completions_practice_id_user_id_key" ON "practice_completions"("practice_id", "user_id");

-- CreateIndex
CREATE INDEX "practice_completions_user_id_idx" ON "practice_completions"("user_id");

-- CreateIndex
CREATE INDEX "practice_completions_practice_id_idx" ON "practice_completions"("practice_id");

-- CreateIndex
CREATE UNIQUE INDEX "openings_moves_key" ON "openings"("moves");

-- CreateIndex
CREATE INDEX "openings_eco_idx" ON "openings"("eco");

-- CreateIndex
CREATE INDEX "openings_name_idx" ON "openings"("name");

-- CreateIndex
CREATE UNIQUE INDEX "opening_moves_opening_id_move_key" ON "opening_moves"("opening_id", "move");

-- CreateIndex
CREATE INDEX "opening_moves_opening_id_move_number_idx" ON "opening_moves"("opening_id", "move_number");

-- CreateIndex
CREATE UNIQUE INDEX "opening_games_opening_id_game_id_key" ON "opening_games"("opening_id", "game_id");

-- CreateIndex
CREATE INDEX "opening_games_opening_id_idx" ON "opening_games"("opening_id");

-- CreateIndex
CREATE INDEX "opening_games_game_id_idx" ON "opening_games"("game_id");

-- AddForeignKey
ALTER TABLE "studies" ADD CONSTRAINT "studies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_chapters" ADD CONSTRAINT "study_chapters_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_comments" ADD CONSTRAINT "study_comments_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_comments" ADD CONSTRAINT "study_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_likes" ADD CONSTRAINT "study_likes_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_likes" ADD CONSTRAINT "study_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_lessons" ADD CONSTRAINT "practice_lessons_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_completions" ADD CONSTRAINT "practice_completions_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_completions" ADD CONSTRAINT "practice_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_moves" ADD CONSTRAINT "opening_moves_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_games" ADD CONSTRAINT "opening_games_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_games" ADD CONSTRAINT "opening_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

