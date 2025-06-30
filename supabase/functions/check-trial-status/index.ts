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

    const { organizationId } = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: organizationId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check trial status
    const { data: subscription, error } = await supabaseClient
      .from('subscriptions')
      .select('plan_name, status, trial_start_date, trial_end_date')
      .eq('organization_id', organizationId)
      .single()

    if (error) {
      // No subscription found
      return new Response(
        JSON.stringify({ 
          success: true,
          isInTrial: false,
          hasActiveSubscription: false,
          trialDaysRemaining: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if it's a trial and still active
    const isInTrial = subscription.plan_name === 'TRIAL' && 
                      subscription.trial_end_date && 
                      new Date(subscription.trial_end_date) > new Date() &&
                      (subscription.status === 'active' || subscription.status === 'trialing')

    // Calculate trial days remaining
    let trialDaysRemaining = 0
    if (isInTrial && subscription.trial_end_date) {
      const endDate = new Date(subscription.trial_end_date)
      const now = new Date()
      trialDaysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    }

    // Check if has any active subscription (trial or paid)
    const hasActiveSubscription = subscription.status === 'active' || 
                                  subscription.status === 'trialing'

    return new Response(
      JSON.stringify({ 
        success: true,
        isInTrial: isInTrial,
        hasActiveSubscription: hasActiveSubscription,
        trialDaysRemaining: trialDaysRemaining
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error checking trial status:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})