import { updateSubscriptionQuantity } from '@/services/subscriptionService';

export interface SeatInfo {
  subscribedSeats: number;    // What admin pays for
  activeUsers: number;        // Current users in system
  availableSeats: number;     // Seats available for new users
}

export interface AddUserResult {
  canAdd: boolean;
  needsUpgrade: boolean;
  newSeatCount?: number;
  prorationDetails?: any;
  message: string;
}

export interface RemoveUserResult {
  subscribedSeats: number;
  activeUsers: number;
  availableSeats: number;
  message: string;
}

/**
 * Calculate seat information for an organization
 */
export const calculateSeatInfo = (subscription: any, currentActiveUsers: number): SeatInfo => {
  const subscribedSeats = subscription?.user_count || 1;
  const availableSeats = Math.max(0, subscribedSeats - currentActiveUsers);
  
  return {
    subscribedSeats,
    activeUsers: currentActiveUsers,
    availableSeats
  };
};

/**
 * Check if adding a user is possible and what it requires
 */
export const canAddUser = (seatInfo: SeatInfo): { canAdd: boolean; needsUpgrade: boolean } => {
  const afterAdding = seatInfo.activeUsers + 1;
  
  if (afterAdding <= seatInfo.subscribedSeats) {
    return { canAdd: true, needsUpgrade: false };   // Use available seat
  } else {
    return { canAdd: true, needsUpgrade: true };    // Need to upgrade
  }
};

/**
 * Handle adding a user with seat management
 */
export const handleAddUser = async (
  organizationId: string, 
  subscription: any, 
  currentActiveUsers: number
): Promise<AddUserResult> => {
  const seatInfo = calculateSeatInfo(subscription, currentActiveUsers);
  const { canAdd, needsUpgrade } = canAddUser(seatInfo);
  
  if (!canAdd) {
    return {
      canAdd: false,
      needsUpgrade: false,
      message: 'Cannot add user'
    };
  }
  
  if (!needsUpgrade) {
    // ✅ Using available seat - no payment needed
    return {
      canAdd: true,
      needsUpgrade: false,
      message: `User added using available seat. ${seatInfo.availableSeats - 1} seats remaining.`
    };
  }
  
  // 💳 Need to upgrade subscription
  if (!subscription?.stripe_subscription_id || subscription.status !== 'active') {
    return {
      canAdd: false,
      needsUpgrade: true,
      message: 'Cannot upgrade trial subscription. Please upgrade to paid plan first.'
    };
  }
  
  try {
    const newSeatCount = currentActiveUsers + 1;
    const result = await updateSubscriptionQuantity(
      organizationId,
      newSeatCount,
      'always_invoice'
    );
    
    return {
      canAdd: true,
      needsUpgrade: true,
      newSeatCount: result.new_user_count,
      prorationDetails: result.proration_details,
      message: `Subscription upgraded to ${result.new_user_count} seats. User added successfully.`
    };
    
  } catch (error) {
    console.error('Failed to upgrade subscription:', error);
    return {
      canAdd: false,
      needsUpgrade: true,
      message: `Subscription upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Handle removing a user (no subscription changes needed)
 */
export const handleRemoveUser = (
  subscription: any, 
  currentActiveUsers: number
): RemoveUserResult => {
  const subscribedSeats = subscription?.user_count || 1;
  const newActiveUsers = currentActiveUsers - 1;
  const availableSeats = subscribedSeats - newActiveUsers;
  
  return {
    subscribedSeats,
    activeUsers: newActiveUsers,
    availableSeats,
    message: `User removed. ${availableSeats} seat${availableSeats === 1 ? '' : 's'} now available for reuse.`
  };
};

/**
 * Format seat information for UI display
 */
export const formatSeatInfo = (seatInfo: SeatInfo): string => {
  const { subscribedSeats, activeUsers, availableSeats } = seatInfo;
  
  if (availableSeats > 0) {
    return `${activeUsers}/${subscribedSeats} seats used (${availableSeats} available)`;
  } else {
    return `${activeUsers}/${subscribedSeats} seats used (at limit)`;
  }
};

/**
 * Get seat status for UI indicators
 */
export const getSeatStatus = (seatInfo: SeatInfo): 'available' | 'full' | 'over-limit' => {
  if (seatInfo.availableSeats > 0) return 'available';
  if (seatInfo.availableSeats === 0) return 'full';
  return 'over-limit'; // This shouldn't happen in normal flow
}; 