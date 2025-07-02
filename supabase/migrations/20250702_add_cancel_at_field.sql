-- Add cancel_at field back to subscriptions table for scheduled cancellations
-- This field stores the exact date/time when a subscription is scheduled to be canceled
-- Different from cancel_at_period_end which is boolean for "cancel at end of current period"

ALTER TABLE subscriptions 
ADD COLUMN cancel_at TIMESTAMP WITH TIME ZONE NULL;

-- Add comment for clarity
COMMENT ON COLUMN subscriptions.cancel_at IS 'Exact timestamp when subscription is scheduled to cancel (for specific date cancellations)';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'Boolean flag indicating if subscription should cancel at the end of current billing period'; 