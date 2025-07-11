// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { 
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts"

// Helper function to map Stripe product features to our feature format
function mapProductFeatures(stripeFeatures: any[]) {
  const features: any = {};
  console.log('Mapping Stripe features:', stripeFeatures);
  
  stripeFeatures.forEach(feature => {
    const featureName = feature.name.toLowerCase();
    
    // Map Microsoft Authenticator Verifications
    if (featureName.includes('microsoft authenticator') || featureName.includes('push')) {
      features.push_verifications = 'unlimited';
    }
    
    // Map Log Retention
    if (featureName.includes('log retention')) {
      if (featureName.includes('3 months') || featureName.includes('3 month')) {
        features.log_retention = '3 months';
      } else if (featureName.includes('1 year') || featureName.includes('12 months')) {
        features.log_retention = '1 year';
      } else {
        features.log_retention = '1 year'; // Default
      }
    }
    
    // Map SSO
    if (featureName.includes('single sign on') || featureName.includes('sso') || featureName.includes('entra id')) {
      features.sso = true;
    }
    
    // Map SMS Verifications
    if (featureName.includes('sms') || featureName.includes('text code')) {
      features.sms_verifications = true;
    }
    
    // Map Teams Verification (if needed in future)
    if (featureName.includes('teams verification')) {
      features.teams_verification = true;
    }
    
    // Map Syslog Integration (if needed in future)
    if (featureName.includes('syslog')) {
      features.syslog_integration = true;
    }
  });
  
  // Set defaults if not found
  if (!features.push_verifications) {
    features.push_verifications = 'unlimited';
  }
  if (!features.log_retention) {
    features.log_retention = '3 months';
  }
  if (features.sso === undefined) {
    features.sso = true;
  }
  
  return features;
}

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
        features: mapProductFeatures(product.features || []),
        formatted_price: `$${((price?.unit_amount || 0) / 100).toString()}`,
        billing_interval: `per ${price?.recurring?.interval || 'month'}`
      }
    })

    // Sort plans in desired order: Basic, Professional, Enterprise
    const planOrder = ['basic', 'professional', 'enterprise'];
    const sortedPlans = plans.sort((a, b) => {
      const aIndex = planOrder.indexOf(a.id.toLowerCase());
      const bIndex = planOrder.indexOf(b.id.toLowerCase());
      return aIndex - bIndex;
    });

    return createSuccessResponse({
      plans: sortedPlans
    })
  } catch (error) {
    console.error('Error fetching plans:', error)
    return createErrorResponse(error.message, 500)
  }
}) 