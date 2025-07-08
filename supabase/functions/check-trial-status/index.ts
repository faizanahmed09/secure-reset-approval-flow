// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { organizationId } = await req.json()

    if (!organizationId) {
      return createErrorResponse('Missing required field: organizationId', 400)
    }

    // Check trial status
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('plan_name, status, trial_start_date, trial_end_date')
      .eq('organization_id', organizationId)
      .single()

    if (error) {
      // No subscription found
      return createSuccessResponse({
        isInTrial: false,
        hasActiveSubscription: false,
        trialDaysRemaining: 0
      })
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

    return createSuccessResponse({
      isInTrial: isInTrial,
      hasActiveSubscription: hasActiveSubscription,
      trialDaysRemaining: trialDaysRemaining
    })

  } catch (error) {
    console.error('Error checking trial status:', error)
    return createErrorResponse(error.message, 500)
  }
})