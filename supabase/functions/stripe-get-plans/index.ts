// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Fetch all products
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
    })

    // Map products to our plan format
    const plans = products.data.map(product => {
      const price = product.default_price as Stripe.Price
      
      return {
        id: product.name.toLowerCase(),
        name: product.name,
        description: product.description || `${product.name} plan`,
        stripe_price_id: price?.id || '',
        stripe_product_id: product.id,
        amount: price?.unit_amount || 0,
        currency: price?.currency || 'usd',
        interval: price?.recurring?.interval || 'month',
        interval_count: price?.recurring?.interval_count || 1,
        trial_period_days: 14, // Default trial period
        max_users: null, // unlimited
        features: {
          push_verifications: 'unlimited',
          log_retention: product.name === 'Basic' ? '3 months' : '1 year',
          sso: true,
          ...(product.name === 'Professional' && { 
            sms_verifications: true 
          }),
          ...(product.name === 'Enterprise' && { 
            sms_verifications: true,
            teams_verification: true,
            syslog_integration: true
          })
        },
        formatted_price: `$${((price?.unit_amount || 0) / 100).toString()}`,
        billing_interval: `per ${price?.recurring?.interval || 'month'}`
      }
    })

    // Show all active plans
    const activePlans = plans

    return createSuccessResponse({
      plans: activePlans
    })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return createErrorResponse(error.message, 500)
  }
}) 