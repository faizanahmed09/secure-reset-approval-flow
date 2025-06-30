# Subscription Flow Architecture

## Overview
This document explains how the subscription system works in our application with the cleaned up, non-redundant architecture.

## Trial Creation Flow

### Automatic Trial Creation
Trials are automatically created when an organization is first set up:

1. **User completes organization setup** → `organization-setup` page
2. **Organization is updated** → `update-organization` edge function
3. **Trial subscription created** → calls `create-trial-subscription` edge function
4. **15-day trial starts** → Organization can use all features

### Edge Functions

#### `update-organization`
- Updates organization details (name, display_name)
- Calls `create-trial-subscription` internally
- Handles errors gracefully (won't fail if trial creation fails)

#### `create-trial-subscription`
- **Single responsibility**: Create trial subscriptions only
- Checks if organization already has a subscription
- Creates 15-day trial if none exists
- Prevents duplicate subscriptions

#### `stripe-get-subscription`
- Fetches organization's current subscription status
- Handles both trial and paid subscriptions
- Returns formatted data with plan details

#### `check-trial-status`
- Checks if organization is currently in trial
- Calculates days remaining
- Used for UI state management

## Subscription States

### Trial Subscription
```json
{
  "plan_name": "TRIAL",
  "status": "trialing",
  "trial_start_date": "2025-01-01T00:00:00Z",
  "trial_end_date": "2025-01-16T00:00:00Z"
}
```

### Paid Subscription (via Stripe webhook)
```json
{
  "plan_name": "STARTER",
  "status": "active",
  "stripe_customer_id": "cus_xxx",
  "stripe_subscription_id": "sub_xxx",
  "current_period_start": "2025-01-01T00:00:00Z",
  "current_period_end": "2025-02-01T00:00:00Z"
}
```

## Key Benefits

1. **No Redundancy**: Single function responsible for trial creation
2. **Clean Separation**: Organization updates and subscription creation are separate concerns
3. **Error Handling**: Organization setup doesn't fail if trial creation fails
4. **Reusable**: `create-trial-subscription` can be called from anywhere
5. **Simple**: Frontend just calls organization setup, everything else is automatic

## Database Schema

```sql
-- Single table handles both trial and paid subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    organization_id UUID UNIQUE REFERENCES organizations(id),
    plan_name TEXT CHECK (plan_name IN ('TRIAL', 'STARTER')),
    status TEXT DEFAULT 'active',
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    -- ... other fields
);
```

## Frontend Integration

The frontend subscription service automatically handles all subscription operations without needing to manually create trials:

```typescript
// This is all that's needed - trial creation is automatic
await organizationService.updateOrganization({
  organizationId,
  organizationName,
  userEmail
});

// Check subscription status anytime
const status = await getSubscriptionStatus(userId);
``` 