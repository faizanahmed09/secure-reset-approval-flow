# Seat-Based Subscription Management Guide

## Overview

This guide explains how to handle **seat-based subscriptions** where:
- Admin pays for a fixed number of user seats per month
- Removing users doesn't reduce the subscription (seats remain available)
- Admin can reuse seats by removing/adding users within the seat limit
- Only charge more when exceeding the current seat limit

## How Stripe Handles Quantity Updates

### ✅ **Stripe Fully Supports This**

When you update a subscription quantity, Stripe:
1. **Calculates prorated charges automatically**
2. **Updates billing immediately or at next cycle**
3. **Handles all billing complexity for you**

### Proration Behaviors

| Behavior | Description | Use Case |
|----------|-------------|----------|
| `always_invoice` | Immediate proration and charge | **Recommended** - Charge immediately |
| `create_prorations` | Create proration but don't invoice yet | Batch changes for later billing |
| `none` | No proration, apply at next cycle | No immediate charge |

## Seat-Based Logic

### Key Concepts:
- **Subscribed Seats**: Number of seats admin pays for (stored in `subscription.user_count`)
- **Active Users**: Number of users currently using the system
- **Available Seats**: `subscribed_seats - active_users`

### Business Rules:
1. **Adding users within seat limit**: ✅ No charge
2. **Adding users beyond seat limit**: 💳 Upgrade subscription and charge prorated amount  
3. **Removing users**: ✅ No refund, seat becomes available for reuse

## Implementation

### 1. When User is Added

```typescript
import { updateSubscriptionQuantity } from '@/services/subscriptionService';

const handleAddUser = async (organizationId: string, subscription: any, activeUserCount: number) => {
  const subscribedSeats = subscription.user_count; // What they pay for
  const newActiveUserCount = activeUserCount + 1;
  
  console.log(`Subscribed seats: ${subscribedSeats}`);
  console.log(`Current active users: ${activeUserCount}`);
  console.log(`After adding: ${newActiveUserCount}`);
  
  if (newActiveUserCount <= subscribedSeats) {
    // ✅ Within seat limit - no Stripe update needed
    console.log('✅ User added within seat limit - no additional charge');
    console.log(`Available seats remaining: ${subscribedSeats - newActiveUserCount}`);
    return { needsPayment: false, availableSeats: subscribedSeats - newActiveUserCount };
  } else {
    // 💳 Exceeds seat limit - need to upgrade subscription
    console.log('💳 Exceeds seat limit - upgrading subscription');
    
    try {
      const result = await updateSubscriptionQuantity(
        organizationId,
        newActiveUserCount,
        'always_invoice' // Charge prorated amount for additional seats
      );
      
      console.log('Subscription upgraded:', result);
      console.log(`Old seats: ${result.old_user_count}`);
      console.log(`New seats: ${result.new_user_count}`);
      
      return { 
        needsPayment: true, 
        prorationDetails: result.proration_details,
        newSeatCount: result.new_user_count
      };
      
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      throw new Error('Cannot add user - subscription upgrade failed');
    }
  }
};
```

### 2. When User is Removed

```typescript
const handleRemoveUser = async (organizationId: string, subscription: any, activeUserCount: number) => {
  const subscribedSeats = subscription.user_count;
  const newActiveUserCount = activeUserCount - 1;
  
  console.log('👤 User removed from organization');
  console.log(`Subscribed seats: ${subscribedSeats} (unchanged)`);
  console.log(`Active users: ${activeUserCount} → ${newActiveUserCount}`);
  console.log(`Available seats: ${subscribedSeats - newActiveUserCount}`);
  
  // ✅ No Stripe update needed - admin keeps paying for the same number of seats
  // The removed user's seat becomes available for reuse
  
  return {
    subscribedSeats: subscribedSeats,
    activeUsers: newActiveUserCount,
    availableSeats: subscribedSeats - newActiveUserCount,
    message: `User removed. You have ${subscribedSeats - newActiveUserCount} available seats remaining.`
  };
};
```

### 3. Integration with User Management

```typescript
// In your user service or component
const createUser = async (userData: any) => {
  try {
    // 1. First create the user in your database
    const newUser = await createDatabaseUser(userData);
    
    // 2. Get current subscription info
    const subscription = await getSubscriptionStatus(currentUserId);
    
    // 3. Update Stripe subscription quantity (only for paid subscriptions)
    if (subscription.subscription?.stripe_subscription_id && 
        subscription.subscription.status === 'active') {
      
      await updateSubscriptionQuantity(
        subscription.subscription.organization_id,
        subscription.subscription.user_count + 1
      );
    }
    
    return newUser;
  } catch (error) {
    // If subscription update fails, you might want to:
    // - Revert user creation
    // - Show warning to admin
    // - Continue but flag for manual review
    throw error;
  }
};
```

## Seat-Based Billing Examples

### Scenario 1: Add User Within Seat Limit

**Current subscription:**
- Subscribed seats: 3 seats ($27/month)
- Active users: 2 users
- Available seats: 1

**When adding 3rd user:**
```
✅ No charge needed
- User added to available seat
- Still paying $27/month for 3 seats
- Available seats: 0
```

### Scenario 2: Add User Beyond Seat Limit

**Current subscription:**
- Subscribed seats: 3 seats ($27/month) 
- Active users: 3 users
- Available seats: 0

**When adding 4th user:**
```
💳 Subscription upgrade needed
- Upgrade from 3 seats to 4 seats
- New price: $36/month (4 × $9)
- Proration: $9 × (15 days / 30 days) = $4.50

Result: Customer charged $4.50 immediately
Next invoice: Full $36/month for 4 seats
```

### Scenario 3: Remove User (Most Common)

**Current subscription:**
- Subscribed seats: 3 seats ($27/month)
- Active users: 3 users  
- Available seats: 0

**When removing 1 user:**
```
✅ No billing change
- Admin still pays $27/month for 3 seats
- Available seats: 1 (can add another user anytime)
- No refund given

Admin can now add a different user without any charge
```

## Edge Function Details

### Request Format
```typescript
POST /functions/v1/update-subscription-quantity
{
  "organization_id": "uuid-here",
  "new_user_count": 3,
  "proration_behavior": "always_invoice"
}
```

### Response Format
```typescript
{
  "success": true,
  "organization_id": "uuid-here",
  "old_user_count": 2,
  "new_user_count": 3,
  "proration_behavior": "always_invoice",
  "proration_details": {
    "days_remaining": 15,
    "current_period_end": "2024-02-15T10:30:00.000Z",
    "quantity_change": 1,
    "note": "Proration will appear on next invoice"
  },
  "stripe_subscription_id": "sub_1234567890",
  "updated_at": "2024-01-31T10:30:00.000Z"
}
```

## Safety Considerations

### 1. **Trial Users**
- Function only works for paid subscriptions (`status: 'active'`)
- Trial users don't have Stripe subscriptions to update
- Handle this gracefully in your UI

### 2. **Minimum Users**
- Enforce minimum 1 user per subscription
- Consider business rules (e.g., must have at least 1 admin)

### 3. **Error Handling**
- If Stripe update fails, decide whether to:
  - Revert user creation/deletion
  - Continue but flag for manual review
  - Show warning to admin

### 4. **Race Conditions**
- Consider locking during user operations
- Handle concurrent user additions/removals

## UI Integration Ideas

### User Addition Within Seat Limit
```
"Adding John Doe to your organization.
✅ No additional charge (using available seat)
Subscribed seats: 3 | Active users: 2 → 3 | Available: 1 → 0

[Add User]"
```

### User Addition Beyond Seat Limit
```
"Adding John Doe will exceed your current seat limit.
💳 Subscription upgrade required: 3 → 4 seats
You'll be charged $4.50 (prorated) for the remaining 15 days.
Next billing cycle: $36/month for 4 seats.

[Upgrade & Add User] [Cancel]"
```

### User Removal Confirmation  
```
"Remove John Doe from your organization?
✅ No billing change - seat becomes available for reuse
Subscribed seats: 3 (unchanged) | Active users: 3 → 2 | Available: 0 → 1

[Remove User] [Cancel]"
```

### Seat Usage Dashboard
```
📊 Subscription Overview
├── Plan: Starter ($9 per seat/month)
├── Subscribed Seats: 3 seats
├── Active Users: 2 users  
├── Available Seats: 1 seat
└── Next Billing: $27 on Feb 15th

💡 You can add 1 more user without additional charge
```

## Webhook Integration

The existing `stripe-webhook` function will automatically handle:
- Subscription updates from Stripe
- Status changes
- Failed payments
- Metadata updates

Your local database will stay in sync automatically.

## Summary

✅ **Stripe fully supports quantity updates**  
✅ **Automatic proration handling**  
✅ **Immediate or delayed billing options**  
✅ **Seamless integration with your existing webhook setup**

This approach gives you complete flexibility in managing user-based subscriptions while letting Stripe handle all the complex billing calculations. 