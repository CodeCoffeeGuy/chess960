-- CreateTable
CREATE TABLE "puzzles" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "moves" TEXT[],
    "rating" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "day" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzles_day_key" ON "puzzles"("day");

-- CreateIndex
CREATE INDEX "puzzles_day_idx" ON "puzzles"("day");

-- CreateIndex
CREATE INDEX "puzzles_rating_idx" ON "puzzles"("rating");

-- CreateIndex
CREATE INDEX "puzzles_plays_idx" ON "puzzles"("plays");

-- CreateIndex
CREATE INDEX "puzzles_game_id_idx" ON "puzzles"("game_id");

-- AddForeignKey
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;














