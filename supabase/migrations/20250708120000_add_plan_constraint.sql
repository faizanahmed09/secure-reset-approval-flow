-- Optional: Add plan name constraint for data integrity
-- Run this ONLY if you want to enforce valid plan names

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_plan_name_check 
CHECK (plan_name = ANY (ARRAY['TRIAL'::text, 'BASIC'::text, 'PROFESSIONAL'::text, 'ENTERPRISE'::text, 'RESTRICTED'::text])); 