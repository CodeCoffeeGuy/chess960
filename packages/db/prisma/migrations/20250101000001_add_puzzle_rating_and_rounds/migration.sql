-- CreateTable
CREATE TABLE "puzzle_ratings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" DECIMAL(10,2) NOT NULL DEFAULT 1500,
    "rd" DECIMAL(10,2) NOT NULL DEFAULT 350,
    "vol" DECIMAL(10,4) NOT NULL DEFAULT 0.06,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_rounds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "win" BOOLEAN NOT NULL DEFAULT false,
    "rating_before" INTEGER NOT NULL,
    "rating_after" INTEGER NOT NULL,
    "rating_diff" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_ratings_user_id_key" ON "puzzle_ratings"("user_id");

-- CreateIndex
CREATE INDEX "puzzle_ratings_user_id_idx" ON "puzzle_ratings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_rounds_user_id_puzzle_id_key" ON "puzzle_rounds"("user_id", "puzzle_id");

-- CreateIndex
CREATE INDEX "puzzle_rounds_user_id_idx" ON "puzzle_rounds"("user_id");

-- CreateIndex
CREATE INDEX "puzzle_rounds_puzzle_id_idx" ON "puzzle_rounds"("puzzle_id");

-- CreateIndex
CREATE INDEX "puzzle_rounds_created_at_idx" ON "puzzle_rounds"("created_at");

-- AddForeignKey
ALTER TABLE "puzzle_ratings" ADD CONSTRAINT "puzzle_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_rounds" ADD CONSTRAINT "puzzle_rounds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_rounds" ADD CONSTRAINT "puzzle_rounds_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;














