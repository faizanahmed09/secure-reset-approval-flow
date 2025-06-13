revoke delete on table "public"."azure_users" from "anon";

revoke insert on table "public"."azure_users" from "anon";

revoke references on table "public"."azure_users" from "anon";

revoke select on table "public"."azure_users" from "anon";

revoke trigger on table "public"."azure_users" from "anon";

revoke truncate on table "public"."azure_users" from "anon";

revoke update on table "public"."azure_users" from "anon";

revoke delete on table "public"."azure_users" from "authenticated";

revoke insert on table "public"."azure_users" from "authenticated";

revoke references on table "public"."azure_users" from "authenticated";

revoke select on table "public"."azure_users" from "authenticated";

revoke trigger on table "public"."azure_users" from "authenticated";

revoke truncate on table "public"."azure_users" from "authenticated";

revoke update on table "public"."azure_users" from "authenticated";

revoke delete on table "public"."azure_users" from "service_role";

revoke insert on table "public"."azure_users" from "service_role";

revoke references on table "public"."azure_users" from "service_role";

revoke select on table "public"."azure_users" from "service_role";

revoke trigger on table "public"."azure_users" from "service_role";

revoke truncate on table "public"."azure_users" from "service_role";

revoke update on table "public"."azure_users" from "service_role";

alter table "public"."azure_users" drop constraint "azure_users_pkey";

drop index if exists "public"."azure_users_pkey";

drop table "public"."azure_users";

alter table "public"."change_requests" add column "updated_at" timestamp with time zone not null default now();


