// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { 
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    // Initialize Supabase with service role key (this is an internal function)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { userId, returnUrl } = await req.json();

    if (!userId) {
      return createErrorResponse('Missing required field: userId', 400);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get user's organization
    const { data: user, error: userError } = await supabase
      .from('azure_users')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (userError || !user?.organization_id) {
      return createErrorResponse('User not found or no organization', 404);
    }

    // Get the subscription with customer ID for user's organization
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, plan_name')
      .eq('organization_id', user.organization_id)
      .single();

    if (subscriptionError || !subscription) {
      return createErrorResponse('No subscription found. Please subscribe first.', 404);
    }

    // Check if it's a paid subscription with Stripe customer ID
    if (!subscription.stripe_customer_id || subscription.plan_name === 'TRIAL') {
      return createErrorResponse('No paid subscription found. Please upgrade from trial first.', 400);
    }

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl || 'http://localhost:3000/subscription',
    });

    return createSuccessResponse({
      url: portalSession.url
    });

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    
    // Handle Stripe-specific errors with detailed information
    if (error.type === 'invalid_request_error' && error.code === 'resource_missing') {
      if (error.param === 'customer') {
        return createErrorResponse('Customer not found in Stripe. The subscription may have been deleted or moved. Please contact support.', 404);
      }
    }
    
    // Handle other Stripe errors
    if (error.code) {
      const stripeErrorMsg = error.message || 'Unknown Stripe error';
      const errorDetails = [];
      
      if (error.code) errorDetails.push(`Code: ${error.code}`);
      if (error.type) errorDetails.push(`Type: ${error.type}`);
      if (error.param) errorDetails.push(`Parameter: ${error.param}`);
      
      const detailedMessage = errorDetails.length > 0 
        ? `${stripeErrorMsg} (${errorDetails.join(', ')})`
        : stripeErrorMsg;
        
      return createErrorResponse(detailedMessage, error.statusCode || 400);
    }
    
    // For non-Stripe errors, return the original message
    return createErrorResponse(error.message || 'An unexpected error occurred', 500);
  }
}); 