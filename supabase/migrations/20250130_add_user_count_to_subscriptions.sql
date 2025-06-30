-- Add user_count column to subscriptions table for accurate pricing calculations
-- This tracks the number of admin + verifier users at the time of subscription

ALTER TABLE subscriptions ADD COLUMN user_count INTEGER DEFAULT 1; 