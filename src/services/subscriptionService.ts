const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lbyvutzdimidlzgbjstz.supabase.co";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const idToken = window.sessionStorage.getItem('idToken');
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
  }

  return headers;
};

// Dynamic plan details from Stripe - Ordered: Basic, Professional, Enterprise
export const BASIC_PLAN: SubscriptionPlan = {
  id: 'basic',
  name: 'Basic',
  description: 'Perfect for small teams',
  stripe_price_id: 'price_1RhDSy07fQQSE43Cy1zlZZ14',
  stripe_product_id: 'prod_ScSNiw3Cw9404l',
  amount: 900, // $9.00 in cents
  currency: 'usd',
  interval: 'month',
  interval_count: 1,
  trial_period_days: 14,
  max_users: null, // unlimited
  features: {
    push_verifications: 'unlimited',
    log_retention: '3 months',
    sso: true
  },
  formatted_price: '$9',
  billing_interval: 'per month'
};

export const PROFESSIONAL_PLAN: SubscriptionPlan = {
  id: 'professional',
  name: 'Professional',
  description: 'Advanced features for growing teams',
  stripe_price_id: 'price_1RhDUU07fQQSE43Cgfdj9p6k',
  stripe_product_id: 'prod_ScSPl9xaR3f8si',
  amount: 1900, // $19.00 in cents
  currency: 'usd',
  interval: 'month',
  interval_count: 1,
  trial_period_days: 14,
  max_users: null, // unlimited
  features: {
    push_verifications: 'unlimited',
    sms_verifications: true,
    log_retention: '1 year',
    sso: true
  },
  formatted_price: '$19',
  billing_interval: 'per month'
};

export const ENTERPRISE_PLAN: SubscriptionPlan = {
  id: 'enterprise',
  name: 'Enterprise',
  description: 'Enterprise-grade security and support',
  stripe_price_id: 'price_1RhDWO07fQQSE43CRL3LrPrU',
  stripe_product_id: 'prod_ScSR8NhgmmS471',
  amount: 2900, // $29.00 in cents
  currency: 'usd',
  interval: 'month',
  interval_count: 1,
  trial_period_days: 14,
  max_users: null, // unlimited
  features: {
    push_verifications: 'unlimited',
    teams_verification: true,
    sms_verifications: true,
    syslog_integration: true,
    log_retention: '1 year',
    sso: true
  },
  formatted_price: '$29',
  billing_interval: 'per month'
};

export const RESTRICTED_PLAN = {
  name: 'Restricted',
  description: 'Trial expired - subscription required',
  formatted_price: 'Subscription Required',
  features: {
    push_verifications: 'none',
    log_retention: 'none',
    sso: false
  }
};

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  stripe_price_id: string;
  stripe_product_id: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  interval_count: number;
  trial_period_days: number;
  max_users: number | null;
  features: Record<string, any>;
  formatted_price: string;
  billing_interval: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  plan_name: 'TRIAL' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE' | 'RESTRICTED';
  status: string;
  user_count: number; // Number of seats subscribed for
  trial_start_date?: string;
  trial_end_date?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  cancel_at?: string; // For scheduled cancellations at specific dates
  plan?: {
    name: string;
    description: string;
    amount: number;
    currency: string;
    interval: string;
    max_users: number | null;
    features: Record<string, any>;
    formatted_price: string;
  };
  days_until_renewal?: number;
  is_trial: boolean;
  trial_days_remaining?: number;
}

export interface Customer {
  stripe_customer_id: string;
  email: string;
}

export interface SubscriptionStatus {
  success: boolean;
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  isInTrial: boolean;
  trialDaysRemaining?: number;
}

/**
 * Get available subscription plans (dynamic from Stripe)
 */
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-get-plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch plans');
    }

    return data.plans || [];
  } catch (error) {
    console.error('Error fetching dynamic plans, falling back to hardcoded plans:', error);
    // Fallback to hardcoded plans in correct order if dynamic fetch fails
    return [BASIC_PLAN, PROFESSIONAL_PLAN, ENTERPRISE_PLAN];
  }
};

/**
 * Create a Stripe checkout session for a subscription
 */
export const createCheckoutSession = async (params: {
  priceId: string;
  userEmail: string;
  userId: string;
  organizationId?: string;
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; url: string; customerId: string }> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Checkout failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Get user's current subscription status (now organization-based)
 */
export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionStatus> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-get-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch subscription status');
    }

    return data;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
};

/**
 * Check if organization is in trial period
 */
export const isOrganizationInTrial = async (organizationId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/check-trial-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to check trial status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.isInTrial || false;
  } catch (error) {
    console.error('Error checking trial status:', error);
    return false;
  }
};

/**
 * Create a customer portal session for subscription management
 */
export const createCustomerPortalSession = async (params: {
  userId: string;
  returnUrl?: string;
}): Promise<{ url: string }> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-customer-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Extract detailed error message from the response
      const errorMessage = errorData.error || errorData.message || `Portal creation failed: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || data.message || 'Failed to create customer portal session');
    }

    return { url: data.url };
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw error;
  }
};

/**
 * Redirect to Stripe Checkout
 */
export const redirectToCheckout = async (params: {
  priceId: string;
  userEmail: string;
  userId: string;
  organizationId?: string;
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<void> => {
  try {
    const { url } = await createCheckoutSession(params);
    window.location.href = url;
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};

/**
 * Redirect to Stripe Customer Portal
 */
export const redirectToCustomerPortal = async (params: {
  userId: string;
  returnUrl?: string;
}): Promise<void> => {
  try {
    const { url } = await createCustomerPortalSession(params);
    window.location.href = url;
  } catch (error) {
    console.error('Error redirecting to customer portal:', error);
    throw error;
  }
};

/**
 * Check if user has subscription access and handle expired trials
 */
export const checkSubscriptionAccess = async (userId: string): Promise<{
  hasAccess: boolean;
  reason?: string;
  subscription?: any;
}> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to check subscription access: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking subscription access:', error);
    return {
      hasAccess: false,
      reason: 'Unable to verify subscription status'
    };
  }
};

/**
 * Get organization user count and pricing information
 */
export const getOrganizationUserCount = async (organizationId: string): Promise<{
  userCount: number;
  adminCount: number;
  verifierCount: number;
  pricing: {
    basePrice: number;
    totalAmount: number;
    formattedPrice: string;
    breakdown: string;
  };
}> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-organization-user-count`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get user count: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get organization user count');
    }

    return {
      userCount: data.userCount,
      adminCount: data.adminCount,
      verifierCount: data.verifierCount,
      pricing: data.pricing
    };
  } catch (error) {
    console.error('Error getting organization user count:', error);
    throw error;
  }
};

/**
 * Update subscription quantity when users are added/removed
 */
export const updateSubscriptionQuantity = async (
  organizationId: string, 
  newUserCount: number, 
  prorationBehavior: 'always_invoice' | 'none' | 'create_prorations' = 'always_invoice'
): Promise<{
  success: boolean;
  organization_id: string;
  old_user_count: number;
  new_user_count: number;
  proration_behavior: string;
  proration_details?: {
    days_remaining: number;
    current_period_end: string;
    quantity_change: number;
    note: string;
  };
  stripe_subscription_id: string;
  updated_at: string;
}> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-subscription-quantity`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        organization_id: organizationId,
        new_user_count: newUserCount,
        proration_behavior: prorationBehavior
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to update subscription quantity: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to update subscription quantity');
    }

    return data;
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    throw error;
  }
};



