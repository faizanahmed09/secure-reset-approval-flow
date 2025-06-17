-- Add role column to azure_users table
ALTER TABLE "public"."azure_users" 
ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'basic' 
CHECK (role IN ('admin', 'verifier', 'basic'));

-- Create index for role
CREATE INDEX IF NOT EXISTS "idx_azure_users_role" ON "public"."azure_users" USING "btree" ("role"); 