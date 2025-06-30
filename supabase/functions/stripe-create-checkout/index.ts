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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { priceId, userEmail, userId, organizationId, quantity, successUrl, cancelUrl } = await req.json()
    if (!priceId || !userEmail || !userId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: priceId, userEmail, userId, organizationId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Default quantity to 1 if not provided
    const subscriptionQuantity = quantity || 1

    // Check if organization already has a customer ID
    let { data: existingSubscription } = await supabaseClient
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
      await supabaseClient
        .from('subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('organization_id', organizationId)
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
      success_url: successUrl || `${Deno.env.get('FRONTEND_URL_LOCAL')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${Deno.env.get('FRONTEND_URL_LOCAL')}/subscription/cancel`,
      metadata: {
        user_id: userId,
        organization_id: organizationId,
        plan_name: 'STARTER', // Hardcoded since we only have one plan
        user_count: subscriptionQuantity.toString(),
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          organization_id: organizationId,
          plan_name: 'STARTER',
          user_count: subscriptionQuantity.toString(),
        },
      },
      allow_promotion_codes: true,
      automatic_tax: { enabled: false }, // Set to true if you want automatic tax calculation
    })

    return new Response(
      JSON.stringify({ 
        sessionId: session.id, 
        url: session.url,
        customerId: stripeCustomerId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 