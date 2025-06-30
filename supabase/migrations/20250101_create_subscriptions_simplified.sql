-- Create simplified subscriptions table for organization-based subscription management
-- Handles both trial and paid subscriptions in a single table per organization

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
    stripe_customer_id TEXT NULL,
    stripe_subscription_id TEXT NULL,
    stripe_price_id TEXT NULL,
    plan_name TEXT NOT NULL CHECK (plan_name IN ('TRIAL', 'STARTER')),
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')) DEFAULT 'active',
    start_date TIMESTAMPTZ NULL,
    end_date TIMESTAMPTZ NULL,
    trial_start_date TIMESTAMPTZ NULL,
    trial_end_date TIMESTAMPTZ NULL,
    cancels_at TIMESTAMPTZ NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    current_period_start TIMESTAMPTZ NULL,
    current_period_end TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_plan_name ON subscriptions(plan_name);

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
