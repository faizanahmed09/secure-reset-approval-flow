

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_pending_users"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM public.pending_users
  WHERE expires_at < NOW() AND NOT processed;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_pending_users"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_pending_users"() IS 'Cleans up expired pending user records that were not processed';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."azure_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "token" "text",
    "token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_login_at" timestamp with time zone,
    "is_active" boolean NOT NULL,
    "object_id" "text",
    "organization_id" "uuid",
    "role" "text" DEFAULT 'basic'::"text" NOT NULL,
    "name" "text" DEFAULT ''::"text",
    CONSTRAINT "azure_users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'verifier'::"text", 'basic'::"text"])))
);


ALTER TABLE "public"."azure_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notification_sent" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "context_id" "text",
    "admin_object_id" "text",
    "admin_name" "text",
    "admin_email" "text",
    "tenant_id" "text"
);


ALTER TABLE "public"."change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mfa_secrets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "secret_value" "text" NOT NULL,
    "key_id" "text",
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "text",
    "sp_id" "text",
    "organization_id" "uuid"
);


ALTER TABLE "public"."mfa_secrets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_configuration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organization_configuration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "display_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "plan_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "trial_start_date" timestamp with time zone,
    "trial_end_date" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_count" integer DEFAULT 1,
    "cancel_at" timestamp with time zone,
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'incomplete'::"text", 'incomplete_expired'::"text", 'past_due'::"text", 'trialing'::"text", 'unpaid'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subscriptions"."cancel_at_period_end" IS 'Boolean flag indicating if subscription should cancel at the end of current billing period';



COMMENT ON COLUMN "public"."subscriptions"."cancel_at" IS 'Exact timestamp when subscription is scheduled to cancel (for specific date cancellations)';



ALTER TABLE ONLY "public"."azure_users"
    ADD CONSTRAINT "azure_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_secrets"
    ADD CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_configuration"
    ADD CONSTRAINT "organization_configuration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_configuration"
    ADD CONSTRAINT "organization_configuration_tenant_client_unique" UNIQUE ("tenant_id", "client_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_azure_users_name" ON "public"."azure_users" USING "btree" ("name");



CREATE INDEX "idx_azure_users_organization_id" ON "public"."azure_users" USING "btree" ("organization_id");



CREATE INDEX "idx_azure_users_role" ON "public"."azure_users" USING "btree" ("role");



CREATE INDEX "idx_mfa_secrets_organization_id" ON "public"."mfa_secrets" USING "btree" ("organization_id");



CREATE INDEX "idx_mfa_secrets_sp_id" ON "public"."mfa_secrets" USING "btree" ("sp_id");



CREATE INDEX "idx_mfa_secrets_tenant_id" ON "public"."mfa_secrets" USING "btree" ("tenant_id");



CREATE INDEX "idx_organization_configuration_client_id" ON "public"."organization_configuration" USING "btree" ("client_id");



CREATE INDEX "idx_organization_configuration_organization_id" ON "public"."organization_configuration" USING "btree" ("organization_id");



CREATE INDEX "idx_organization_configuration_tenant_id" ON "public"."organization_configuration" USING "btree" ("tenant_id");



CREATE INDEX "idx_organizations_domain" ON "public"."organizations" USING "btree" ("domain");



CREATE INDEX "idx_organizations_name" ON "public"."organizations" USING "btree" ("name");



CREATE INDEX "idx_subscriptions_organization_id" ON "public"."subscriptions" USING "btree" ("organization_id");



CREATE INDEX "idx_subscriptions_plan_name" ON "public"."subscriptions" USING "btree" ("plan_name");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE OR REPLACE TRIGGER "update_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."mfa_secrets"
    ADD CONSTRAINT "fk_mfa_secrets_organization" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."azure_users"
    ADD CONSTRAINT "fk_organization" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_configuration"
    ADD CONSTRAINT "organization_configuration_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Enable select for authenticated users only" ON "public"."change_requests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable select for authenticated users only" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_pending_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_pending_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_pending_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."azure_users" TO "anon";
GRANT ALL ON TABLE "public"."azure_users" TO "authenticated";
GRANT ALL ON TABLE "public"."azure_users" TO "service_role";



GRANT ALL ON TABLE "public"."change_requests" TO "anon";
GRANT ALL ON TABLE "public"."change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_secrets" TO "anon";
GRANT ALL ON TABLE "public"."mfa_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_secrets" TO "service_role";



GRANT ALL ON TABLE "public"."organization_configuration" TO "anon";
GRANT ALL ON TABLE "public"."organization_configuration" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_configuration" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






RESET ALL;
