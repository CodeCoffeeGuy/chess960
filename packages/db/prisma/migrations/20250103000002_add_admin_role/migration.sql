-- Add isAdmin field to users table
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- Create index for admin queries
CREATE INDEX "users_is_admin_idx" ON "users"("is_admin");



