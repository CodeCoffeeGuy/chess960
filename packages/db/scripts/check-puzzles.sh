#!/bin/bash
# Convenience script to check puzzle status
# Usage: ./scripts/check-puzzles.sh

export DATABASE_URL="postgresql://neondb_owner:npg_PDarGg6v3bfn@ep-ancient-heart-a2lqb2ul-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

cd "$(dirname "$0")/.." || exit 1
pnpm exec tsx scripts/check-puzzles.ts














