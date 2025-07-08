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
    // Initialize Supabase with service role key (this is an internal function)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { organizationId } = await req.json()

    if (!organizationId) {
      return createErrorResponse("Missing required field: organizationId", 400)
    }

    // Count admin and verifier users in the organization with a single query
    const { data: userCounts, error: userError } = await supabase
      .from('azure_users')
      .select('role')
      .eq('organization_id', organizationId)
      .in('role', ['admin', 'verifier'])

    if (userError) {
      console.error('Error fetching organization users:', userError)
      return createErrorResponse('Failed to fetch organization users', 500)
    }

    const userCount = userCounts ? userCounts.length : 0
    const adminCount = userCounts ? userCounts.filter(u => u.role === 'admin').length : 0
    const verifierCount = userCounts ? userCounts.filter(u => u.role === 'verifier').length : 0

    // Calculate pricing based on user count
    const basePrice = 9 // $9 per user
    const totalAmount = userCount * basePrice * 100 // Convert to cents
    const formattedPrice = `$${userCount * basePrice}`

    return createSuccessResponse({
      userCount,
      adminCount,
      verifierCount,
      pricing: {
        basePrice,
        totalAmount, // in cents
        formattedPrice,
        breakdown: `${userCount} users × $${basePrice} = ${formattedPrice}`
      }
    })

  } catch (error) {
    console.error('Error getting organization user count:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : String(error),
      500
    )
  }
}) 