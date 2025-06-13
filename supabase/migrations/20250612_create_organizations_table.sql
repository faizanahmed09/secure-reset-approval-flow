-- Create organizations table
CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL UNIQUE,
    "domain" "text" NOT NULL UNIQUE,
    "display_name" "text",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- Set table owner
ALTER TABLE "public"."organizations" OWNER TO "postgres";

-- Add primary key constraint
ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

-- Create indexes for better performance
CREATE INDEX "idx_organizations_name" ON "public"."organizations" USING "btree" ("name");
CREATE INDEX "idx_organizations_domain" ON "public"."organizations" USING "btree" ("domain");

-- Add organization_id column to azure_users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name='azure_users' AND column_name='organization_id'
    ) THEN
        ALTER TABLE "public"."azure_users" 
        ADD COLUMN "organization_id" "uuid";
    END IF;
END $$;

-- Add or replace the foreign key constraint
ALTER TABLE "public"."azure_users"
    DROP CONSTRAINT IF EXISTS "azure_users_organization_id_fkey",
    ADD CONSTRAINT "azure_users_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS "idx_azure_users_organization_id" ON "public"."azure_users" USING "btree" ("organization_id");

-- Grant permissions
GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";

-- Enable RLS (Row Level Security) if needed
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;

-- Create policy for organizations (adjust as needed)
CREATE POLICY "Enable select for authenticated users only" ON "public"."organizations" 
FOR SELECT TO "authenticated" USING (true);