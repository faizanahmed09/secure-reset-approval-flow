-- Add organization_id column to mfa_secrets table
ALTER TABLE "public"."mfa_secrets" 
ADD COLUMN "organization_id" uuid;

-- Add foreign key constraint
ALTER TABLE "public"."mfa_secrets" 
ADD CONSTRAINT "fk_mfa_secrets_organization" 
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX "idx_mfa_secrets_organization_id" ON "public"."mfa_secrets" USING "btree" ("organization_id");

-- Update existing records to have organization_id (if any exist)
-- This assumes we can match by tenant_id to organization_configuration table
UPDATE "public"."mfa_secrets" 
SET "organization_id" = (
  SELECT oc."organization_id" 
  FROM "public"."organization_configuration" oc 
  WHERE oc."tenant_id" = "mfa_secrets"."tenant_id" 
  AND oc."client_id" = "mfa_secrets"."client_id"
  LIMIT 1
)
WHERE "organization_id" IS NULL; 