

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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."azure_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "object_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "token" "text",
    "token_expires_at" timestamp with time zone,
    "last_login_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
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
    "sp_id" "text"
);


ALTER TABLE "public"."mfa_secrets" OWNER TO "postgres";


ALTER TABLE ONLY "public"."azure_users"
    ADD CONSTRAINT "azure_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_requests"
    ADD CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mfa_secrets"
    ADD CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id");




CREATE INDEX "idx_mfa_secrets_sp_id" ON "public"."mfa_secrets" USING "btree" ("sp_id");



CREATE INDEX "idx_mfa_secrets_tenant_id" ON "public"."mfa_secrets" USING "btree" ("tenant_id");



CREATE POLICY "Enable select for authenticated users only" ON "public"."change_requests" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."azure_users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


























































































































































































GRANT ALL ON TABLE "public"."azure_users" TO "anon";
GRANT ALL ON TABLE "public"."azure_users" TO "authenticated";
GRANT ALL ON TABLE "public"."azure_users" TO "service_role";



GRANT ALL ON TABLE "public"."change_requests" TO "anon";
GRANT ALL ON TABLE "public"."change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."mfa_secrets" TO "anon";
GRANT ALL ON TABLE "public"."mfa_secrets" TO "authenticated";
GRANT ALL ON TABLE "public"."mfa_secrets" TO "service_role";









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
