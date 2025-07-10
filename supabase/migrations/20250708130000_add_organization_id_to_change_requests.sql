-- Add organization_id column to change_requests table
ALTER TABLE "public"."change_requests" 
ADD COLUMN "organization_id" "uuid";

-- Add foreign key constraint
ALTER TABLE "public"."change_requests" 
ADD CONSTRAINT "change_requests_organization_id_fkey" 
FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

-- Update existing change_requests to set organization_id based on tenant_id
-- This maps existing records to organizations based on the tenant_id in organization_configuration
UPDATE "public"."change_requests" 
SET "organization_id" = (
  SELECT oc.organization_id 
  FROM "public"."organization_configuration" oc 
  WHERE oc.tenant_id = "public"."change_requests"."tenant_id"
  LIMIT 1
)
WHERE "organization_id" IS NULL;

-- Add index for better performance
CREATE INDEX "change_requests_organization_id_idx" ON "public"."change_requests" ("organization_id");

-- Add index for combined queries
CREATE INDEX "change_requests_org_created_idx" ON "public"."change_requests" ("organization_id", "created_at");

-- Add comment explaining the change
COMMENT ON COLUMN "public"."change_requests"."organization_id" IS 'References the organization this change request belongs to. Used for multi-tenant isolation within the same Azure AD tenant.'; 