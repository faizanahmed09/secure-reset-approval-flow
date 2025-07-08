// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { 
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight()
  }

  try {
    // This is an internal service function - no authentication needed
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse("Server configuration error: Missing Supabase credentials", 500)
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { organizationId } = await req.json()

    if (!organizationId) {
      return createErrorResponse('Missing required field: organizationId', 400)
    }

    // Check if organization already has a subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('organization_id', organizationId)
      .single()

    if (existingSubscription) {
      return createErrorResponse('Organization already has a subscription', 400)
    }

    // Create trial subscription
    const trialStartDate = new Date()
    const trialEndDate = new Date()
    trialEndDate.setDate(trialStartDate.getDate() + 14) // 14 days trial

    const { data: newSubscription, error } = await supabase
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

    return createSuccessResponse({
      subscriptionId: newSubscription.id,
      message: '14-day trial subscription created successfully'
    })

  } catch (error) {
    console.error('Error creating trial subscription:', error)
    return createErrorResponse(error.message, 500)
  }
})