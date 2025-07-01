// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's organization
    const { data: user, error: userError } = await supabaseClient
      .from('azure_users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return new Response(
        JSON.stringify({ 
          success: true,
          hasActiveSubscription: false,
          isInTrial: false,
          subscription: null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get organization subscription
    const { data: subscription, error: subscriptionError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('organization_id', user.organization_id)
      .single()

    if (subscriptionError || !subscription) {
      return new Response(
        JSON.stringify({ 
          success: true,
          hasActiveSubscription: false,
          isInTrial: false,
          subscription: null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if subscription is active (either trial or paid)
    const isActiveSubscription = subscription.status === 'active' || 
                                 subscription.status === 'trialing'

    const isInTrial = subscription.plan_name === 'TRIAL' && 
                      subscription.trial_end_date && 
                      new Date(subscription.trial_end_date) > new Date()

    // Calculate trial days remaining
    let trialDaysRemaining = null
    if (isInTrial && subscription.trial_end_date) {
      const endDate = new Date(subscription.trial_end_date)
      const now = new Date()
      trialDaysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    }

    // Calculate days until renewal
    let daysUntilRenewal = null
    if (subscription.current_period_end) {
      const endDate = new Date(subscription.current_period_end)
      const now = new Date()
      daysUntilRenewal = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Format plan details
    let planDetails = null
    if (subscription.plan_name === 'STARTER') {
      // Use stored user count from database, fallback to 1
      const userCount = subscription.user_count || 1
      const totalAmount = userCount * 900 // $9 per user in cents
      
      planDetails = {
        name: 'Starter',
        description: 'Perfect for small teams',
        amount: totalAmount,
        currency: 'usd',
        interval: 'month',
        max_users: null, // unlimited
        features: {
          push_verifications: 'unlimited',
          log_retention: '3 months',
          sso: true
        },
        formatted_price: `$${(totalAmount / 100)}`
      }
    } else if (subscription.plan_name === 'TRIAL') {
      planDetails = {
        name: 'Trial',
        description: '15-day free trial',
        amount: 0,
        currency: 'usd',
        interval: 'trial',
        max_users: null,
        features: {
          push_verifications: 'unlimited',
          log_retention: '3 months',
          sso: true
        },
        formatted_price: 'Free'
      }
    } else if (subscription.plan_name === 'RESTRICTED') {
      planDetails = {
        name: 'Restricted',
        description: 'Trial expired - subscription required',
        amount: 0,
        currency: 'usd',
        interval: 'restricted',
        max_users: null,
        features: {
          push_verifications: 'none',
          log_retention: 'none',
          sso: false
        },
        formatted_price: 'Subscription Required'
      }
    }

    // Format the subscription response
    const formattedSubscription = {
      id: subscription.id,
      organization_id: subscription.organization_id,
      stripe_customer_id: subscription.stripe_customer_id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_price_id: subscription.stripe_price_id,
      plan_name: subscription.plan_name,
      status: subscription.status,
      user_count: subscription.user_count || 1, // ✅ FIXED - Include user_count field
      trial_start_date: subscription.trial_start_date,
      trial_end_date: subscription.trial_end_date,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      plan: planDetails,
      is_trial: isInTrial,
      trial_days_remaining: trialDaysRemaining,
      days_until_renewal: daysUntilRenewal,
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        hasActiveSubscription: isActiveSubscription,
        isInTrial: isInTrial,
        trialDaysRemaining: trialDaysRemaining,
        subscription: formattedSubscription
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error fetching subscription:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})