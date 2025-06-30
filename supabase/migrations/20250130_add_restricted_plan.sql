-- Add RESTRICTED plan type for expired trial users
-- This allows organizations to be in a restricted state when their trial expires without payment

-- First, drop the existing constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_name_check;

-- Add the new constraint with RESTRICTED option
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_name_check 
CHECK (plan_name IN ('TRIAL', 'STARTER', 'RESTRICTED')); 