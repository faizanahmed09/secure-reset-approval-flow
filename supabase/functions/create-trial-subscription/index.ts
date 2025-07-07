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

    // Check if organization already has a subscription
    const { data: existingSubscription } = await supabaseClient
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .single()

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Organization already has a subscription' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create trial subscription
    const trialStartDate = new Date()
    const trialEndDate = new Date()
    trialEndDate.setDate(trialStartDate.getDate() + 14) // 14 days trial

    const { data: newSubscription, error } = await supabaseClient
      .from('subscriptions')
      .insert({
        organization_id: organizationId,
        plan_name: 'TRIAL',
        status: 'trialing',
        trial_start_date: trialStartDate.toISOString(),
        trial_end_date: trialEndDate.toISOString()
      })
      .select('id')
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscriptionId: newSubscription.id,
        message: '14-day trial subscription created successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating trial subscription:', error)
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