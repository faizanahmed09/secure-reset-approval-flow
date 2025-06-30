# Stripe Subscription Integration Setup Guide

## Overview

This guide walks you through setting up the complete Stripe subscription integration with your Supabase Edge Functions and Next.js application.

## 1. Prerequisites

- Stripe account ([create one here](https://dashboard.stripe.com/register))
- Supabase project with Edge Functions enabled
- Your application already set up with authentication

## 2. Stripe Dashboard Setup

### A. Get API Keys
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers > API keys**
3. Copy your **Publishable key** and **Secret key** (use test keys for development)

### B. Create Products and Prices
1. Go to **Products** in your Stripe dashboard
2. Create products for each subscription tier:
   - **Basic Plan**: e.g., $29.99/month
   - **Pro Plan**: e.g., $99.99/month  
   - **Enterprise Plan**: e.g., $199.99/month
3. Copy the **Price IDs** (they start with `price_`)

### C. Update Database Plans
Update the subscription plans in your database migration file (`supabase/migrations/20250623_create_subscriptions_table.sql`) with your actual Stripe Price IDs:

```sql
INSERT INTO subscription_plans (name, description, stripe_price_id, stripe_product_id, amount, interval, max_users, features) 
VALUES 
    ('Basic Plan', 'Perfect for small teams', 'price_YOUR_BASIC_PRICE_ID', 'prod_YOUR_BASIC_PRODUCT_ID', 2999, 'month', 10, '{"mfa_resets": 100, "user_management": true, "email_support": true}'),
    ('Pro Plan', 'For growing organizations', 'price_YOUR_PRO_PRICE_ID', 'prod_YOUR_PRO_PRODUCT_ID', 9999, 'month', 50, '{"mfa_resets": 500, "user_management": true, "email_support": true, "phone_support": true, "advanced_analytics": true}'),
    ('Enterprise Plan', 'For large organizations', 'price_YOUR_ENTERPRISE_PRICE_ID', 'prod_YOUR_ENTERPRISE_PRODUCT_ID', 19999, 'month', null, '{"mfa_resets": -1, "user_management": true, "email_support": true, "phone_support": true, "advanced_analytics": true, "custom_integrations": true, "sla": true}')
ON CONFLICT (stripe_price_id) DO NOTHING;
```

## 3. Environment Variables

Add these environment variables to your project:

### For Supabase Edge Functions (.env):
```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### For Next.js Frontend (.env.local):
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## 4. Supabase Setup

### A. Run Database Migrations
```bash
cd supabase
supabase db push
```

### B. Deploy Edge Functions
```bash
# Deploy all Stripe functions
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-get-plans
supabase functions deploy stripe-get-subscription
supabase functions deploy stripe-customer-portal
```

### C. Set Environment Variables for Edge Functions
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
supabase secrets set FRONTEND_URL=http://localhost:3000
```

## 5. Webhook Configuration

### A. Set Up Webhook Endpoint
1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Use this URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### B. Copy Webhook Secret
1. After creating the webhook, copy the **Signing secret**
2. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

## 6. Customer Portal Configuration

1. In Stripe Dashboard, go to **Settings > Billing > Customer portal**
2. Activate the customer portal
3. Configure which features customers can access:
   - ✅ Update payment methods
   - ✅ View billing history
   - ✅ Download invoices
   - ✅ Cancel subscriptions (optional)
   - ✅ Update subscriptions (optional)

## 7. Testing

### A. Test with Stripe Test Cards
Use these test card numbers:
- **Successful payment**: `4242424242424242`
- **Payment requires authentication**: `4000002500003155`
- **Payment is declined**: `4000000000000002`

### B. Test the Flow
1. Navigate to `/subscription` in your app
2. Click "Subscribe Now" on any plan
3. Complete checkout with a test card
4. Verify webhook events in Stripe Dashboard
5. Check that subscription appears in your database
6. Test the customer portal access

## 8. Production Deployment

### A. Switch to Live Keys
1. Replace all `sk_test_` and `pk_test_` keys with live keys
2. Update webhook endpoints to production URLs
3. Update `FRONTEND_URL` to your production domain

### B. Security Checklist
- ✅ Never expose secret keys in frontend code
- ✅ Validate webhook signatures
- ✅ Use HTTPS for all webhook endpoints
- ✅ Set up proper CORS headers
- ✅ Enable Stripe's fraud detection

## 9. Usage in Your Application

### A. Display Subscription Plans
```typescript
import SubscriptionPlans from '@/components/SubscriptionPlans';

// In your component
<SubscriptionPlans />
```

### B. Show Subscription Status
```typescript
import SubscriptionStatusComponent from '@/components/SubscriptionStatus';

// In your component
<SubscriptionStatusComponent userId={user.id} showManagement={true} />
```

### C. Check Subscription Programmatically
```typescript
import { getSubscriptionStatus } from '@/services/subscriptionService';

const checkSubscription = async () => {
  const status = await getSubscriptionStatus(userId);
  if (status.hasActiveSubscription) {
    // User has active subscription
    console.log('Current plan:', status.subscription.plan.name);
  }
};
```

## 10. Customization

### A. Modify Plans
- Update the database `subscription_plans` table
- Create corresponding products/prices in Stripe
- Update the display logic in components

### B. Add Features
- Add new fields to the `features` JSONB column
- Update the `formatFeature` function in components
- Implement feature checking in your application logic

### C. Custom Styling
- Modify the components in `src/components/` to match your design
- Update the plan icons and styling
- Customize success/cancel pages

## 11. Troubleshooting

### Common Issues:

1. **Webhook not receiving events**
   - Check webhook URL is correct
   - Verify webhook secret matches
   - Check Supabase function logs

2. **Subscription not showing after payment**
   - Check webhook events were processed
   - Verify database has subscription record
   - Check user_id in subscription metadata

3. **Customer portal not working**
   - Ensure customer portal is activated in Stripe
   - Check customer exists in Stripe
   - Verify return URL is correct

4. **Environment variables not working**
   - Verify all required variables are set
   - Check variable names match exactly
   - Restart services after updating variables

## 12. Support

For additional help:
- [Stripe Documentation](https://stripe.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Next.js Documentation](https://nextjs.org/docs)

## 13. Security Best Practices

- Always validate webhook signatures
- Use environment variables for all secrets
- Implement proper error handling
- Log important events for debugging
- Set up monitoring for failed payments
- Use Stripe's test mode during development
- Regularly update Stripe SDK versions 