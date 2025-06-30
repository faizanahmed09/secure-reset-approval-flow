// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { organizationId } = await req.json()

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: organizationId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Count admin and verifier users in the organization
    const { data: users, error: userError } = await supabaseClient
      .from('azure_users')
      .select('role')
      .eq('organization_id', organizationId)
      .in('role', ['admin', 'verifier'])

    if (userError) {
      console.error('Error fetching organization users:', userError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch organization users',
          details: userError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const userCount = users ? users.length : 0
    const adminCount = users ? users.filter(u => u.role === 'admin').length : 0
    const verifierCount = users ? users.filter(u => u.role === 'verifier').length : 0

    // Calculate pricing based on user count
    const basePrice = 9 // $9 per user
    const totalAmount = userCount * basePrice * 100 // Convert to cents
    const formattedPrice = `$${userCount * basePrice}`

    return new Response(
      JSON.stringify({ 
        success: true,
        userCount,
        adminCount,
        verifierCount,
        pricing: {
          basePrice,
          totalAmount, // in cents
          formattedPrice,
          breakdown: `${userCount} users × $${basePrice} = ${formattedPrice}`
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error getting organization user count:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 