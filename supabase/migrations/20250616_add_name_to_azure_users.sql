-- Add name column to azure_users table
ALTER TABLE "public"."azure_users" 
ADD COLUMN IF NOT EXISTS "name" text DEFAULT '';

-- Create index for name
CREATE INDEX IF NOT EXISTS "idx_azure_users_name" ON "public"."azure_users" USING "btree" ("name"); 