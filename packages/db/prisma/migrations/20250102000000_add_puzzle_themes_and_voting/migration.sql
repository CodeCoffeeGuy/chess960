-- AlterTable
ALTER TABLE "puzzles" ADD COLUMN "themes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "puzzle_theme_votes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_theme_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_theme_votes_user_id_puzzle_id_theme_key" ON "puzzle_theme_votes"("user_id", "puzzle_id", "theme");

-- CreateIndex
CREATE INDEX "puzzle_theme_votes_puzzle_id_idx" ON "puzzle_theme_votes"("puzzle_id");

-- CreateIndex
CREATE INDEX "puzzle_theme_votes_theme_idx" ON "puzzle_theme_votes"("theme");

-- AddForeignKey
ALTER TABLE "puzzle_theme_votes" ADD CONSTRAINT "puzzle_theme_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_theme_votes" ADD CONSTRAINT "puzzle_theme_votes_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;









