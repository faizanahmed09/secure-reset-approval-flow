
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { contextId } = body;

    if (!contextId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing contextId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For development, we'll simulate a response
    // In production, you would check the status in your database or with Azure AD
    
    // Generate a random number between 0 and 1
    const random = Math.random();
    
    // Simulate a 30% chance of approval after each check
    const status = random < 0.3 ? 'approved' : 'pending';
    
    return new Response(
      JSON.stringify({
        success: true,
        status,
        message: status === 'approved' ? 'User has approved the request' : 'Waiting for user response'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking MFA status:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
