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
    console.log('Received request to check MFA status');
    const body = await req.json();
    const { contextId } = body;

    // Validate incoming data
    if (!contextId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Missing contextId parameter' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Retrieve the request details from the database
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not set');
    }
    
    console.log(`Retrieving reset request with contextId: ${contextId}`);
    const response = await fetch(
      `${supabaseUrl}/rest/v1/reset_requests?context_id=eq.${contextId}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to retrieve reset request: ${response.statusText}`);
    }
    
    const requests = await response.json();
    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Reset request not found' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const request = requests[0];
    console.log(`Found reset request for email: ${request.email}`);
    
    // Check if we already have a final status
    if (request.status === 'approved') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'approved',
          message: 'User has approved the request'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else if (request.status === 'rejected') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'rejected',
          message: 'User has rejected the request'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // If we're still pending, check the status with Azure
    try {
      console.log('Checking authentication status with Azure');
      // Generate XML for the status check
      const statusXML = `
        <GetAuthenticationStatusRequest>
          <Version>1.0</Version>
          <UserPrincipalName>${request.email}</UserPrincipalName>
          <ContextId>${contextId}</ContextId>
        </GetAuthenticationStatusRequest>
      `;
      
      // Call the MFA API to check status
      const statusResponse = await fetch('https://adnotifications.windowsazure.com/StrongAuthenticationService.svc/Connector/GetAuthenticationStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': `Bearer ${request.mfa_token}`
        },
        body: statusXML
      });
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to get authentication status: ${statusResponse.statusText}`);
      }
      
      const statusResult = await statusResponse.text();
      console.log('Received authentication status from Azure');
      
      let newStatus = 'pending';
      let statusMessage = 'Authentication is still pending';
      
      // Parse the XML response
      if (statusResult.includes('<AuthenticationResult>true</AuthenticationResult>')) {
        newStatus = 'approved';
        statusMessage = 'User has approved the request';
      } else if (statusResult.includes('<AuthenticationResult>false</AuthenticationResult>')) {
        newStatus = 'rejected';
        statusMessage = 'User has rejected the request';
      }
      
      // Update the status in the database if it changed
      if (newStatus !== 'pending') {
        console.log(`Updating request status to: ${newStatus}`);
        await fetch(
          `${supabaseUrl}/rest/v1/reset_requests?context_id=eq.${contextId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              status: newStatus
            })
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          status: newStatus,
          message: statusMessage
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (error) {
      console.error('Error checking MFA status with Azure:', error);
      
      // Return pending if there's an error checking the status
      return new Response(
        JSON.stringify({
          success: true,
          status: 'pending',
          message: 'Authentication is still pending',
          error: error instanceof Error ? error.message : 'Unknown error checking status'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Error processing request:', error);
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