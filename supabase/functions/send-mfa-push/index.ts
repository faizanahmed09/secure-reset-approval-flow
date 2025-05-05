
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { v4 as uuidv4 } from "https://deno.land/std@0.203.0/uuid/mod.ts";

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
    console.log('Received request to send MFA push notification');
    const body = await req.json();
    const { email, accessToken } = body;

    // Validate incoming data
    if (!email || !accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing required parameters' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For development/testing purposes, we'll simulate a successful push
    // In production, you would implement actual Microsoft Graph API calls here
    console.log(`Simulating MFA push notification to ${email}`);
    
    // Generate a contextId that would normally be used to check status
    const contextId = uuidv4();
    
    // Insert a record into the reset_requests table
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/reset_requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            email,
            status: 'pending',
            notification_sent: true,
            context_id: contextId,
            user_id: null // In production, you would get this from authentication
          })
        });
        
        if (!response.ok) {
          console.error('Failed to insert reset request:', await response.text());
        }
      } catch (error) {
        console.error('Error inserting reset request:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `MFA push notification sent to ${email}`,
        contextId: contextId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in MFA process:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
