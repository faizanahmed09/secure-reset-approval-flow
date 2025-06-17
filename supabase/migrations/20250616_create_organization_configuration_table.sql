-- Create organization_configuration table
CREATE TABLE IF NOT EXISTS "public"."organization_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_configuration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "organization_configuration_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "organization_configuration_tenant_client_unique" UNIQUE ("tenant_id", "client_id")
);

-- Create indexes for better performance
CREATE INDEX "idx_organization_configuration_tenant_id" ON "public"."organization_configuration" USING "btree" ("tenant_id");
CREATE INDEX "idx_organization_configuration_client_id" ON "public"."organization_configuration" USING "btree" ("client_id");
CREATE INDEX "idx_organization_configuration_organization_id" ON "public"."organization_configuration" USING "btree" ("organization_id");

-- Grant permissions
GRANT ALL ON TABLE "public"."organization_configuration" TO "anon";
GRANT ALL ON TABLE "public"."organization_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_configuration" TO "service_role";
