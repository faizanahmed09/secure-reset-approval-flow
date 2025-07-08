// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { 
  authenticateRequestFast,
  requireRole,
  requireOrganization,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts"

interface UpdateQuantityRequest {
  organization_id: string
  new_user_count: number
  proration_behavior?: 'always_invoice' | 'none' | 'create_prorations'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight()
  }

  try {
    // Authenticate user with fast authentication
    const authResult = await authenticateRequestFast(req)
    const { user, dbUser } = authResult

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Require admin role for subscription changes
    try {
      requireRole(dbUser, ['admin'])
    } catch (roleError) {
      return createErrorResponse(roleError.message, 403)
    }

    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405)
    }

    const { organization_id, new_user_count, proration_behavior = 'always_invoice' }: UpdateQuantityRequest = await req.json()

    if (!organization_id || !new_user_count || new_user_count < 1) {
      return createErrorResponse('Invalid organization_id or new_user_count', 400)
    }

    // Ensure user can only access their organization
    try {
      requireOrganization(dbUser, organization_id)
    } catch (orgError) {
      return createErrorResponse(orgError.message, 403)
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    console.log(`=== UPDATING SUBSCRIPTION QUANTITY ===`)
    console.log(`Organization ID: ${organization_id}`)
    console.log(`New user count: ${new_user_count}`)
    console.log(`Proration behavior: ${proration_behavior}`)

    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organization_id)
      .single()

    if (fetchError || !subscription) {
      console.error('❌ Subscription not found:', fetchError)
      return createErrorResponse('Subscription not found', 404)
    }

    console.log(`Current subscription:`)
    console.log(`- Stripe ID: ${subscription.stripe_subscription_id}`)
    console.log(`- Current user count: ${subscription.user_count}`)
    console.log(`- Plan: ${subscription.plan_name}`)
    console.log(`- Status: ${subscription.status}`)

    // Check if subscription is active and has Stripe ID
    if (!subscription.stripe_subscription_id || subscription.status !== 'active') {
      console.error('❌ Cannot update inactive subscription or trial')
      return createErrorResponse('Cannot update quantity for inactive subscription or trial', 400, {
        current_status: subscription.status,
        plan: subscription.plan_name
      })
    }

    // Get Stripe subscription details
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
    
    if (!stripeSubscription.items.data[0]) {
      console.error('❌ No subscription items found')
      return createErrorResponse('No subscription items found', 400)
    }

    const subscriptionItem = stripeSubscription.items.data[0]
    console.log(`Current Stripe quantity: ${subscriptionItem.quantity}`)
    console.log(`Subscription item ID: ${subscriptionItem.id}`)

    // Update subscription quantity in Stripe
    console.log(`🔄 Updating Stripe subscription quantity...`)
    const updatedSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{
        id: subscriptionItem.id,
        quantity: new_user_count
      }],
      proration_behavior: proration_behavior,
      metadata: {
        ...stripeSubscription.metadata,
        user_count: new_user_count.toString()
      }
    })

    console.log(`✅ Stripe subscription updated:`)
    console.log(`- New quantity: ${updatedSubscription.items.data[0].quantity}`)
    console.log(`- Proration behavior: ${proration_behavior}`)
    
    // Calculate proration details if applicable
    let prorationDetails = null
    if (proration_behavior === 'always_invoice' && new_user_count !== subscription.user_count) {
      const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000)
      const now = new Date()
      const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      // This is an estimate - actual proration calculated by Stripe
      prorationDetails = {
        days_remaining: daysRemaining,
        current_period_end: currentPeriodEnd.toISOString(),
        quantity_change: new_user_count - subscription.user_count,
        note: 'Proration will appear on next invoice'
      }
    }

    // Update local database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        user_count: new_user_count,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organization_id)

    if (updateError) {
      console.error('❌ Error updating local database:', updateError)
      // Stripe was updated successfully, but local DB failed
      return createErrorResponse('Stripe updated but local database update failed', 500, {
        stripe_updated: true,
        db_error: updateError.message
      })
    }

    console.log(`✅ Local database updated successfully`)
    console.log(`=== END QUANTITY UPDATE ===`)

    return createSuccessResponse({
      organization_id,
      old_user_count: subscription.user_count,
      new_user_count,
      proration_behavior,
      proration_details: prorationDetails,
      stripe_subscription_id: subscription.stripe_subscription_id,
      updated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error updating subscription quantity:', error)
    return createErrorResponse(error.message, 500, {
      type: 'update_quantity_error'
    })
  }
}) 