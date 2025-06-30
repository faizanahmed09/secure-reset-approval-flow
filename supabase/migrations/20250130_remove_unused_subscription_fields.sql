-- Remove unused subscription fields that are not used by the UI
-- Keeping: current_period_start, current_period_end, cancel_at_period_end, trial_start_date, trial_end_date

-- Remove redundant subscription fields
-- start_date and end_date are redundant with current_period_start/end
-- cancels_at is not used anywhere

-- Remove redundant and unused fields
ALTER TABLE subscriptions DROP COLUMN IF EXISTS start_date;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS end_date;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancels_at; 