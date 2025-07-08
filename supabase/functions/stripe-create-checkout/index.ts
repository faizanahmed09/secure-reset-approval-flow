// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'
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
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { priceId, userEmail, userId, organizationId, quantity, successUrl, cancelUrl } = await req.json()
    if (!priceId || !userEmail || !userId || !organizationId || !successUrl || !cancelUrl) {
      return createErrorResponse('Missing required fields: priceId, userEmail, userId, organizationId, successUrl, cancelUrl', 400)
    }

    // Default quantity to 1 if not provided
    const subscriptionQuantity = quantity || 1

    // Check if organization already has a customer ID
    let { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', organizationId)
      .single()

    let stripeCustomerId = existingSubscription?.stripe_customer_id

    // If no customer exists, create one in Stripe
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: userId,
          organization_id: organizationId,
        },
      })

      stripeCustomerId = stripeCustomer.id

      // Update the subscription record with the customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('organization_id', organizationId)
    }

    // Determine plan name based on price ID
    let planName = 'BASIC' // Default fallback
    if (priceId === 'price_1RhDSy07fQQSE43Cy1zlZZ14') {
      planName = 'BASIC'
    } else if (priceId === 'price_1RhDUU07fQQSE43Cgfdj9p6k') {
      planName = 'PROFESSIONAL'
    } else if (priceId === 'price_1RhDWO07fQQSE43CRL3LrPrU') {
      planName = 'ENTERPRISE'
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: subscriptionQuantity,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        organization_id: organizationId,
        plan_name: planName,
        user_count: subscriptionQuantity.toString(),
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          organization_id: organizationId,
          plan_name: planName,
          user_count: subscriptionQuantity.toString(),
        },
      },
      allow_promotion_codes: true,
      automatic_tax: { enabled: false }, // Set to true if you want automatic tax calculation
    })

    return createSuccessResponse({
      sessionId: session.id, 
      url: session.url,
      customerId: stripeCustomerId
    })

  } catch (error) {
    console.error('Error creating checkout session:', error)
    return createErrorResponse(error.message, 500)
  }
}) 