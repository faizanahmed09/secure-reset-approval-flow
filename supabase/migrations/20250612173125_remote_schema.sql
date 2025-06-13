create table "public"."azure_credentials" (
    "id" uuid not null default gen_random_uuid(),
    "client_id" text not null,
    "client_secret" text not null,
    "tenant_id" text not null,
    "token" text,
    "token_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."azure_credentials" enable row level security;

alter table "public"."azure_users" alter column "is_active" drop default;

alter table "public"."azure_users" alter column "object_id" drop not null;

alter table "public"."azure_users" disable row level security;

CREATE UNIQUE INDEX azure_credentials_pkey ON public.azure_credentials USING btree (id);

alter table "public"."azure_credentials" add constraint "azure_credentials_pkey" PRIMARY KEY using index "azure_credentials_pkey";

grant delete on table "public"."azure_credentials" to "anon";

grant insert on table "public"."azure_credentials" to "anon";

grant references on table "public"."azure_credentials" to "anon";

grant select on table "public"."azure_credentials" to "anon";

grant trigger on table "public"."azure_credentials" to "anon";

grant truncate on table "public"."azure_credentials" to "anon";

grant update on table "public"."azure_credentials" to "anon";

grant delete on table "public"."azure_credentials" to "authenticated";

grant insert on table "public"."azure_credentials" to "authenticated";

grant references on table "public"."azure_credentials" to "authenticated";

grant select on table "public"."azure_credentials" to "authenticated";

grant trigger on table "public"."azure_credentials" to "authenticated";

grant truncate on table "public"."azure_credentials" to "authenticated";

grant update on table "public"."azure_credentials" to "authenticated";

grant delete on table "public"."azure_credentials" to "service_role";

grant insert on table "public"."azure_credentials" to "service_role";

grant references on table "public"."azure_credentials" to "service_role";

grant select on table "public"."azure_credentials" to "service_role";

grant trigger on table "public"."azure_credentials" to "service_role";

grant truncate on table "public"."azure_credentials" to "service_role";

grant update on table "public"."azure_credentials" to "service_role";


