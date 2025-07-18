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
    // Initialize Supabase with service role key for internal operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { userId } = await req.json()

    if (!userId) {
      return createErrorResponse('Missing required field: userId', 400)
    }

    // Get user's organization
    const { data: user, error: userError } = await supabase
      .from('azure_users')
      .select('organization_id')
      .eq('id', userId)
      .single()

    if (userError || !user?.organization_id) {
      return createSuccessResponse({
        hasAccess: false,
        reason: 'User not found or no organization'
      })
    }

    // Get organization subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', user.organization_id)
      .single()

    if (subscriptionError || !subscription) {
      return createSuccessResponse({
        hasAccess: false,
        reason: 'No subscription found'
      })
    }

    const now = new Date()

    // Check if subscription gives access
    let hasAccess = false
    let reason = ''

    if (subscription.status === 'active' && ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].includes(subscription.plan_name)) {
      // Active paid subscription
      hasAccess = true
    } else if (subscription.status === 'trialing' && subscription.plan_name === 'TRIAL') {
      // Check if trial is still valid
      if (subscription.trial_end_date && new Date(subscription.trial_end_date) > now) {
        hasAccess = true
      } else {
        // Trial has expired - update to RESTRICTED
        const { error: updateError } = await supabase
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

    return createSuccessResponse({
      hasAccess,
      reason,
      subscription: {
        plan_name: subscription.plan_name,
        status: subscription.status,
        trial_end_date: subscription.trial_end_date
      }
    })

  } catch (error) {
    console.error('Error checking subscription access:', error)
    return createErrorResponse('Internal error', 500, {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}) 