// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

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
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    // Log the raw body from Stripe for debugging
    console.log('=== STRIPE WEBHOOK BODY ===')
    console.log('Body length:', body.length)
    console.log('Signature present:', !!sig)
    console.log('Raw body preview (first 500 chars):', body.substring(0, 500))
    try {
      const bodyObj = JSON.parse(body)
      console.log('Event type:', bodyObj.type)
      console.log('Event ID:', bodyObj.id)
      console.log('Created:', bodyObj.created ? new Date(bodyObj.created * 1000).toISOString() : 'N/A')
      console.log('API Version:', bodyObj.api_version)
    } catch (parseError) {
      console.log('⚠️  Could not parse body as JSON:', parseError.message)
    }
    console.log('=== END STRIPE WEBHOOK BODY ===\n')

    if (!sig) {
      return new Response('No signature', { status: 400 })
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return new Response('Webhook secret not configured', { status: 500 })
    }

    let event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        sig,
        webhookSecret
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response('Invalid signature', { status: 400 })
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabaseClient)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabaseClient)
        break

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, supabaseClient, stripe)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, supabaseClient)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, supabaseClient)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabaseClient: any) {
  try {
    console.log('=== SUBSCRIPTION UPDATED EVENT ===')
    console.log('Subscription ID:', subscription.id)
    console.log('Stripe Status:', subscription.status)
    
    // Debug timestamp values
    console.log('Raw Timestamps:')
    console.log('- current_period_start (raw):', subscription.current_period_start)
    console.log('- current_period_end (raw):', subscription.current_period_end)
    console.log('- trial_start (raw):', subscription.trial_start)
    console.log('- trial_end (raw):', subscription.trial_end)
    console.log('- cancel_at (raw):', subscription.cancel_at)
    
    console.log('Current Period Start:', subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : 'null')
    console.log('Current Period End:', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : 'null')
    console.log('Cancel at Period End:', subscription.cancel_at_period_end)
    console.log('Cancel At:', subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : 'null')
    
    // Detailed cancellation logging
    console.log('--- CANCELLATION STATUS ANALYSIS ---')
    console.log('🔍 CANCEL_AT_PERIOD_END DETECTION:')
    console.log('  cancel_at_period_end:', subscription.cancel_at_period_end)
    console.log('  cancel_at:', subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : 'null')
    console.log('')
    
    if (subscription.cancel_at) {
      const cancelDate = new Date(subscription.cancel_at * 1000)
      const now = new Date()
      const daysUntilCancel = Math.ceil((cancelDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      console.log('📅 SCHEDULED CANCELLATION:')
      console.log('  Scheduled to cancel on:', cancelDate.toISOString())
      console.log('  Days until cancellation:', daysUntilCancel)
      console.log('  Status will remain active until then')
      console.log('  ⚠️  NOTE: cancel_at date is logged but NOT stored in DB (field removed)')
      console.log('  🎯 EXPECTATION: Will receive customer.subscription.deleted when cancel_at date arrives')
    } else if (subscription.cancel_at_period_end) {
      console.log('📅 CANCEL AT PERIOD END:')
      console.log('  Will cancel at end of current period')
      console.log('  Period ends:', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : 'unknown')
      console.log('  ✅ cancel_at_period_end=true is stored in DB and used by UI')
      console.log('  🎯 EXPECTATION: Will receive customer.subscription.deleted when period ends')
      console.log('  🔄 CURRENT ACTION: Subscription remains active, user can still use service')
    } else {
      console.log('✅ NO CANCELLATION SCHEDULED:')
      console.log('  Subscription will continue renewing normally')
      console.log('  cancel_at_period_end=false')
    }
    console.log('--- END CANCELLATION STATUS ANALYSIS ---')
    
    console.log('Metadata:', subscription.metadata)

    const organizationId = subscription.metadata.organization_id
    const userCount = subscription.metadata.user_count ? parseInt(subscription.metadata.user_count) : 1

    if (!organizationId) {
      console.error('❌ No organization_id found in subscription metadata')
      return
    }

    console.log('Organization ID:', organizationId)
    console.log('User Count:', userCount)

    // Helper function to safely convert timestamp to ISO string with robust fallbacks
    const timestampToISO = (timestamp: number | null | undefined): string | null => {
      if (!timestamp || timestamp === 0 || isNaN(timestamp)) return null
      try {
        const date = new Date(timestamp * 1000)
        if (isNaN(date.getTime())) return null
        return date.toISOString()
      } catch (error) {
        console.error('Invalid timestamp:', timestamp, error)
        return null
      }
    }

    // Robust date extraction with multiple fallbacks
    const getValidDate = (...timestamps: (number | null | undefined)[]): string | null => {
      for (const timestamp of timestamps) {
        const isoDate = timestampToISO(timestamp)
        if (isoDate) return isoDate
      }
      return null
    }

    // ⚠️ CRITICAL DECISION POINT - Now making dynamic based on Stripe status
    console.log('🎯 WEBHOOK DECISION: Making dynamic decision based on Stripe status')
    console.log('📝 Action based on Stripe status:')
    
    let planName = 'STARTER'
    let dbStatus = subscription.status
    
    if (subscription.status === 'unpaid') {
      console.log('🚨 STATUS IS UNPAID - Setting to RESTRICTED plan and unpaid status')
      planName = 'RESTRICTED'
    } else if (subscription.status === 'canceled') {
      console.log('🚨 STATUS IS CANCELED - Setting to RESTRICTED plan and canceled status')
      planName = 'RESTRICTED'
    } else if (subscription.status === 'past_due') {
      console.log('⚠️  STATUS IS PAST_DUE - Keeping STARTER but marking as past_due')
      planName = 'STARTER'
    } else if (subscription.status === 'active') {
      console.log('✅ STATUS IS ACTIVE - Setting to STARTER/active')
      planName = 'STARTER'
    } else {
      console.log(`🔍 UNKNOWN STATUS: ${subscription.status} - Defaulting to STARTER but keeping actual status`)
      planName = 'STARTER'
    }

    // Handle missing period dates with fallbacks
    console.log('🔧 Period Date Handling:')
    if (!subscription.current_period_start) {
      console.log('⚠️  current_period_start is undefined, using current timestamp as fallback')
    }
    if (!subscription.current_period_end) {
      console.log('⚠️  current_period_end is undefined, will calculate from current time + 30 days')
    }

    // Calculate proper dates with better fallbacks
    const now = Math.floor(Date.now() / 1000) // Current timestamp in seconds
    let periodStartDate = getValidDate(subscription.current_period_start) || timestampToISO(now)
    let periodEndDate = getValidDate(subscription.current_period_end)
    
    if (!periodEndDate) {
      // Add 30 days (in seconds) to current timestamp
      const calculatedEndTimestamp = now + (30 * 24 * 60 * 60)
      periodEndDate = timestampToISO(calculatedEndTimestamp)
      console.log('🔧 Calculated period_end from current time + 30 days:', periodEndDate)
    }

    // Update subscription to paid plan
    const updateData = {
      stripe_customer_id: subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id,
      plan_name: planName, // ✅ DYNAMIC - Based on subscription status
      status: dbStatus, // ✅ DYNAMIC - Using actual Stripe status
      user_count: userCount,
      // Only essential date fields for UI and business logic
      current_period_start: periodStartDate,
      current_period_end: periodEndDate,
      trial_start_date: subscription.status === 'trialing' ? getValidDate(subscription.trial_start) : null,
      trial_end_date: subscription.status === 'trialing' ? getValidDate(subscription.trial_end) : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      // NOTE: cancels_at field was removed in migration 20250130_remove_unused_subscription_fields.sql
      // Only cancel_at_period_end is stored in DB and used by UI components
      updated_at: new Date().toISOString()
    }

    console.log('📤 Updating database with:', updateData)
    console.log('🗄️  Database field mapping:')
    console.log('  - Stripe cancel_at_period_end → DB cancel_at_period_end:', updateData.cancel_at_period_end)
    console.log('  - Plan name → DB plan_name:', updateData.plan_name)
    console.log('  - User count → DB user_count:', updateData.user_count)
    console.log('  ⚠️  NOTE: Stripe cancel_at is NOT stored (cancels_at field was removed from DB)')

    const { error } = await supabaseClient
      .from('subscriptions')
      .update(updateData)
      .eq('organization_id', organizationId)

    if (error) {
      console.error('❌ Error upgrading subscription:', error)
    } else {
      console.log(`✅ Successfully updated subscription for organization: ${organizationId} with ${userCount} users`)
      console.log(`📊 Database now shows: Plan=${planName}, Status=${dbStatus}`)
      if (planName === 'RESTRICTED') {
        console.log('🔒 Organization access is now RESTRICTED due to payment issues')
      }
    }
    
  } catch (error) {
    console.error('❌ Error in handleSubscriptionUpdated:', error)
    console.error('Subscription data:', JSON.stringify(subscription, null, 2))
  }
  
  console.log('=== END SUBSCRIPTION UPDATED EVENT ===\n')
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabaseClient: any) {
  console.log('=== SUBSCRIPTION DELETED EVENT ===')
  console.log('🔍 CRITICAL ANALYSIS: Understanding deletion context')
  console.log('')
  
  // Basic subscription info
  console.log('📋 SUBSCRIPTION DETAILS:')
  console.log('  Subscription ID:', subscription.id)
  console.log('  Customer ID:', subscription.customer)
  console.log('  Status at deletion:', subscription.status)
  console.log('  Created:', subscription.created ? new Date(subscription.created * 1000).toISOString() : 'null')
  console.log('  Metadata:', JSON.stringify(subscription.metadata, null, 2))
  console.log('')
  
  // Cancellation timing analysis
  console.log('⏰ CANCELLATION TIMING ANALYSIS:')
  console.log('  canceled_at:', subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : 'null')
  console.log('  current_period_start:', subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : 'null')
  console.log('  current_period_end:', subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : 'null')
  console.log('  cancel_at_period_end:', subscription.cancel_at_period_end)
  console.log('  cancel_at:', subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : 'null')
  console.log('')
  
  // Determine cancellation type
  console.log('🔍 CANCELLATION TYPE DETECTION:')
  const now = Math.floor(Date.now() / 1000)
  const canceledAt = subscription.canceled_at || 0
  const periodEnd = subscription.current_period_end || 0
  
  let cancellationType = 'UNKNOWN'
  let cancellationReason = ''
  
  if (subscription.cancel_at_period_end) {
    cancellationType = 'PERIOD_END_CANCELLATION'
    cancellationReason = 'Subscription was set to cancel at period end and period has now ended'
  } else if (canceledAt && periodEnd) {
    if (Math.abs(canceledAt - periodEnd) < 60) { // Within 60 seconds
      cancellationType = 'PERIOD_END_CANCELLATION'
      cancellationReason = 'Canceled at approximately the same time as period end'
    } else if (canceledAt < periodEnd) {
      cancellationType = 'IMMEDIATE_CANCELLATION'
      cancellationReason = 'Canceled immediately - before the period end date'
    } else {
      cancellationType = 'POST_PERIOD_CANCELLATION'
      cancellationReason = 'Canceled after the period end (unusual)'
    }
  } else if (canceledAt) {
    cancellationType = 'IMMEDIATE_CANCELLATION'
    cancellationReason = 'Canceled immediately - no period end information available'
  }
  
  console.log('  🎯 DETECTED TYPE:', cancellationType)
  console.log('  📝 REASON:', cancellationReason)
  console.log('')
  
  // Cancellation details analysis
  console.log('📄 CANCELLATION DETAILS:')
  if (subscription.cancellation_details) {
    console.log('  Comment:', subscription.cancellation_details.comment || 'none')
    console.log('  Feedback:', subscription.cancellation_details.feedback || 'none')
    console.log('  Reason:', subscription.cancellation_details.reason || 'none')
  } else {
    console.log('  No cancellation details provided')
  }
  console.log('')
  
  // Time calculations
  if (canceledAt && periodEnd) {
    const timeDiff = periodEnd - canceledAt
    const daysDiff = Math.round(timeDiff / (24 * 60 * 60))
    console.log('📊 TIME CALCULATIONS:')
    console.log('  Time between cancellation and period end:', timeDiff, 'seconds')
    console.log('  Days between cancellation and period end:', daysDiff, 'days')
    console.log('  Current time vs period end:', now > periodEnd ? 'AFTER period end' : 'BEFORE period end')
    console.log('')
  }
  
  // Database impact analysis
  console.log('🗄️  DATABASE UPDATE STRATEGY:')
  
  let updateData: any = {
    status: 'canceled',
    updated_at: new Date().toISOString()
  }
  
  if (cancellationType === 'IMMEDIATE_CANCELLATION') {
    console.log('  Strategy: IMMEDIATE_CANCELLATION detected')
    console.log('  Action: Clear period dates to indicate no remaining access')
    updateData.current_period_end = null
    updateData.current_period_start = null
    console.log('  Result: User access should be blocked immediately')
  } else {
    console.log('  Strategy: PERIOD_END_CANCELLATION detected')
    console.log('  Action: Keep period dates to allow access until expiration')
    console.log('  Result: User access continues until period_end, then gets blocked')
  }
  
  console.log('  Update data:', JSON.stringify(updateData, null, 2))
  console.log('')

  // Execute database update
  console.log('💾 EXECUTING DATABASE UPDATE...')
  const { error } = await supabaseClient
    .from('subscriptions')
    .update(updateData)
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    console.error('❌ Error updating deleted subscription:', error)
  } else {
    console.log('✅ Successfully updated subscription in database')
    console.log('📈 EXPECTED FRONTEND BEHAVIOR:')
    if (cancellationType === 'IMMEDIATE_CANCELLATION') {
      console.log('  - Should show "Subscription Expired" (red warning)')
      console.log('  - Should block admin/verifier user creation immediately')
      console.log('  - Should hide seat information card')
      console.log('  - Add User button should show "subscription required" badge')
    } else {
      console.log('  - Should show "Subscription Canceled" (orange warning)')
      console.log('  - Should allow admin/verifier user creation until period end')
      console.log('  - Should show seat information card')
      console.log('  - Add User button should work normally')
    }
  }
  console.log('')
  console.log('=== END SUBSCRIPTION DELETED EVENT ===\n')
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, supabaseClient: any, stripe: Stripe) {
  console.log('=== CHECKOUT SESSION COMPLETED ===')
  console.log('Session ID:', session.id)
  console.log('Mode:', session.mode)
  console.log('Payment Status:', session.payment_status)
  console.log('Customer:', session.customer)
  console.log('Subscription:', session.subscription)
  console.log('Metadata:', session.metadata)

  if (session.mode === 'subscription' && session.subscription) {
    console.log('🔄 Retrieving subscription details from Stripe...')
    try {
      // Retrieve the subscription to get full details
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      console.log('✅ Retrieved subscription:', subscription.id, 'Status:', subscription.status)
      await handleSubscriptionUpdated(subscription, supabaseClient)
      
    } catch (error) {
      console.error('❌ Error retrieving subscription:', error)
    }
  } else {
    console.log('⚠️  Not a subscription checkout or no subscription ID found')
  }
  console.log('=== END CHECKOUT SESSION COMPLETED ===\n')
}



async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, supabaseClient: any) {
  console.log('=== INVOICE PAYMENT SUCCEEDED ===')
  console.log('Invoice ID:', invoice.id)
  console.log('Subscription ID:', invoice.subscription)
  console.log('Amount Paid:', invoice.amount_paid / 100, invoice.currency.toUpperCase())
  console.log('Payment Status:', invoice.status)

  if (invoice.subscription) {
    // Update subscription status to active if it was incomplete
    const { error } = await supabaseClient
      .from('subscriptions')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)
      .eq('status', 'incomplete')

    if (error) {
      console.error('❌ Error updating subscription after successful payment:', error)
    } else {
      console.log('✅ Updated incomplete subscription to active status')
    }
  }
  console.log('=== END INVOICE PAYMENT SUCCEEDED ===\n')
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, supabaseClient: any) {
  console.log('=== INVOICE PAYMENT FAILED ===')
  console.log('Invoice ID:', invoice.id)
  console.log('Subscription ID:', invoice.subscription)
  console.log('Amount Due:', invoice.amount_due / 100, invoice.currency.toUpperCase())
  console.log('Attempt Count:', invoice.attempt_count)
  console.log('Next Payment Attempt:', invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : 'No more attempts')
  console.log('Payment Status:', invoice.status)
  console.log('Billing Reason:', invoice.billing_reason)

  if (invoice.subscription) {
    console.log('🔄 Setting subscription status to past_due due to payment failure')
    
    // Update subscription status based on the subscription status
    const { error } = await supabaseClient
      .from('subscriptions')
      .update({ 
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', invoice.subscription)

    if (error) {
      console.error('❌ Error updating subscription after failed payment:', error)
    } else {
      console.log('✅ Updated subscription to past_due status')
      
      if (!invoice.next_payment_attempt) {
        console.log('🚨 NO MORE PAYMENT ATTEMPTS - This may be the final failure')
        console.log('⏳ Expecting customer.subscription.updated with "unpaid" status soon')
      } else {
        console.log('🔄 Stripe will retry payment on:', new Date(invoice.next_payment_attempt * 1000).toISOString())
      }
    }
  }
  console.log('=== END INVOICE PAYMENT FAILED ===\n')
}

 