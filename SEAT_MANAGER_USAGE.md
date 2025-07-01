# Seat Manager Integration Guide

## Overview

The `seatManager.ts` utility is now integrated into your user management system to handle seat-based subscriptions automatically.

## Files Updated

### 1. **Application Users Page** (`src/app/admin-portal/application-users/page.tsx`)

**✅ Complete Integration Applied**

#### Features Added:
- **Subscription Overview Card** - Shows seat usage at a glance
- **Smart Add User Button** - Displays available seats or upgrade warning
- **Automatic Seat Management** - Handles subscription upgrades when needed
- **Real-time Seat Updates** - Updates seat info after user addition/removal

#### UI Components:

```jsx
// Subscription Overview Card
{isAdmin && seatInfo && subscription && (
  <Card className="mb-6">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Subscription Overview
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{seatInfo.subscribedSeats}</div>
          <div className="text-sm text-muted-foreground">Subscribed Seats</div>
        </div>
        // ... other metrics
      </div>
    </CardContent>
  </Card>
)}
```

#### Smart User Addition Logic:

```jsx
const handleCreateUser = async (azureUser: AzureUser) => {
  // Check seat availability before creating user
  if (subscription && seatInfo) {
    const seatResult = await seatManagerAddUser(
      user.organization_id,
      subscription,
      users.length
    );
    
    if (!seatResult.canAdd) {
      // Show error if can't add
      toast({
        title: 'Cannot Add User',
        description: seatResult.message,
        variant: 'destructive',
      });
      return;
    }
    
    // Show upgrade notification if needed
    if (seatResult.needsUpgrade && seatResult.prorationDetails) {
      toast({
        title: 'Subscription Upgraded',
        description: `Upgraded to ${seatResult.newSeatCount} seats. ${seatResult.message}`,
      });
    }
  }
  
  // Proceed with user creation
  const newUser = await createDatabaseUser(/* ... */);
  // ...
};
```

## How It Works

### 1. **Seat Information Display**

**Live Metrics:**
- **Subscribed Seats**: What admin pays for (e.g., 3 seats)
- **Active Users**: Current users in system (e.g., 2 users)  
- **Available Seats**: Seats left for new users (e.g., 1 available)
- **Status Badge**: Visual indicator of seat capacity

### 2. **Smart Add User Flow**

**Within Seat Limit:**
```
Current: 2 users, 3 subscribed seats
Add user → ✅ Use available seat (no charge)
Result: 3 users, 3 subscribed seats, 0 available
```

**Beyond Seat Limit:**
```
Current: 3 users, 3 subscribed seats  
Add user → 💳 Upgrade to 4 seats (prorated charge)
Result: 4 users, 4 subscribed seats, 0 available
```

### 3. **User Removal Flow**

**Always Seat-Preserving:**
```
Current: 3 users, 3 subscribed seats
Remove user → ✅ Seat becomes available (no refund)
Result: 2 users, 3 subscribed seats, 1 available
```

## Visual Indicators

### 1. **Add User Button**
```jsx
<Button className="relative">
  <UserPlus className="h-4 w-4 mr-2" />
  Add User
  {seatInfo && (
    <Badge variant={seatInfo.availableSeats > 0 ? "secondary" : "destructive"}>
      {seatInfo.availableSeats > 0 
        ? `${seatInfo.availableSeats} free` 
        : 'will upgrade'
      }
    </Badge>
  )}
</Button>
```

### 2. **Dialog Warnings**
```jsx
{seatInfo.availableSeats > 0 ? (
  <span className="text-green-600">
    ✅ {seatInfo.availableSeats} seats available - no additional charge
  </span>
) : (
  <span className="text-orange-600">
    ⚠️ At seat limit - adding users will upgrade subscription
  </span>
)}
```

### 3. **Status Cards**
```jsx
{seatInfo.availableSeats > 0 && (
  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
    <p className="text-sm text-green-800">
      💡 You can add {seatInfo.availableSeats} more users without additional charge.
    </p>
  </div>
)}
```

## Integration in Other Components

### Example: User Profile Component

```jsx
import { calculateSeatInfo, formatSeatInfo } from '@/utils/seatManager';

const UserProfile = ({ subscription, totalUsers }) => {
  const seatInfo = calculateSeatInfo(subscription, totalUsers);
  
  return (
    <div className="seat-info">
      <p>Seat Usage: {formatSeatInfo(seatInfo)}</p>
      <Badge variant={getSeatStatus(seatInfo) === 'available' ? 'secondary' : 'destructive'}>
        {getSeatStatus(seatInfo) === 'available' ? 'Can Add Users' : 'At Limit'}
      </Badge>
    </div>
  );
};
```

### Example: Dashboard Widget

```jsx
import { getSeatStatus } from '@/utils/seatManager';

const DashboardWidget = ({ seatInfo }) => {
  const status = getSeatStatus(seatInfo);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Capacity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between">
          <span>Users: {seatInfo.activeUsers}/{seatInfo.subscribedSeats}</span>
          <Badge variant={status === 'available' ? 'secondary' : 'destructive'}>
            {status === 'available' ? 'Room to grow' : 'At capacity'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
```

## Error Handling

The seat manager handles these scenarios:

1. **Trial Users**: Can't upgrade trial subscriptions
2. **Inactive Subscriptions**: Only works with active paid subscriptions  
3. **API Failures**: Graceful error handling with user feedback
4. **Edge Cases**: Minimum seat validation, concurrent operations

## Toast Notifications

**Successful Addition (No Upgrade):**
```
"User John Doe created successfully"
```

**Successful Addition (With Upgrade):**
```
"Subscription Upgraded"
"Upgraded to 4 seats. User added successfully."
```

**User Removal:**
```
"User deleted successfully. 2 seats now available."
```

**Upgrade Failure:**
```
"Cannot add user - subscription upgrade failed"
```

## Summary

✅ **Complete seat-based subscription management**  
✅ **Real-time UI updates with seat information**  
✅ **Automatic subscription upgrades when needed**  
✅ **User-friendly indicators and warnings**  
✅ **Seamless integration with existing user management**

The seat manager now handles all the complex subscription logic behind the scenes while providing clear visual feedback to admins about their seat usage and costs. 