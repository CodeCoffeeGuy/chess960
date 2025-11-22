-- CreateTable
CREATE TABLE IF NOT EXISTS "storm_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "moves" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "combo" INTEGER NOT NULL DEFAULT 0,
    "time" INTEGER NOT NULL DEFAULT 0,
    "highest" INTEGER NOT NULL DEFAULT 0,
    "puzzles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storm_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "storm_runs_user_id_idx" ON "storm_runs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "storm_runs_day_idx" ON "storm_runs"("day");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "storm_runs_score_idx" ON "storm_runs"("score");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "storm_runs_user_id_day_idx" ON "storm_runs"("user_id", "day");

-- AddForeignKey
ALTER TABLE "storm_runs" ADD CONSTRAINT "storm_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

