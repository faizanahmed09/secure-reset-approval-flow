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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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
          hasAccess: false,
          reason: 'User not found or no organization'
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
          hasAccess: false,
          reason: 'No subscription found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const now = new Date()

    // Check if subscription gives access
    let hasAccess = false
    let reason = ''

    if (subscription.status === 'active' && subscription.plan_name === 'STARTER') {
      // Active paid subscription
      hasAccess = true
    } else if (subscription.status === 'trialing' && subscription.plan_name === 'TRIAL') {
      // Check if trial is still valid
      if (subscription.trial_end_date && new Date(subscription.trial_end_date) > now) {
        hasAccess = true
      } else {
        // Trial has expired - update to RESTRICTED
        const { error: updateError } = await supabaseClient
          .from('subscriptions')
          .update({
            plan_name: 'RESTRICTED',
            status: 'unpaid',
            updated_at: now.toISOString()
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error('Error updating expired trial:', updateError)
        }

        hasAccess = false
        reason = 'Trial expired - subscription required'
      }
    } else if (subscription.plan_name === 'RESTRICTED') {
      hasAccess = false
      reason = 'Subscription required'
    } else {
      hasAccess = false
      reason = 'Invalid subscription status'
    }

    return new Response(
      JSON.stringify({ 
        hasAccess,
        reason,
        subscription: {
          plan_name: subscription.plan_name,
          status: subscription.status,
          trial_end_date: subscription.trial_end_date
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error checking subscription access:', error)
    return new Response(
      JSON.stringify({ 
        hasAccess: false,
        reason: 'Internal error',
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 