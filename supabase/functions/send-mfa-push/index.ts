import { serve } from "https://deno.land/std@0.203.0/http/server.ts";


// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received request to send MFA push notification');
    const body = await req.json();
    body.tenantId = 'db265c9f-9e82-4ad3-ad5c-b5435ba0a6d9';
    
    const { email, accessToken, tenantId } = body;

    // Validate incoming data
    if (!email || !accessToken || !tenantId) {
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


    // # Get ID of 'Entra Id MFA Notification Client' Service Principal
    // $servicePrincipalId = (Get-MgServicePrincipal -Filter "appid eq '981f26a1-7f43-403b-a875-f8b09b8cd720'").Id
    const ClientAppId = '809efbcb-4d5e-4f17-adb1-cddb49f98f30'; // Entra Id MFA Notification Client App ID
    // const ClientAppId = '981f26a1-7f43-403b-a875-f8b09b8cd720'; // Entra Id MFA Notification Client App ID

    const clientSecret = 'K3c8Q~G9x~1zOd-pQaECv3pfqunFCC~9Kn.p-bVn'; // Client Secret for the app
    const mfaServiceToken = await getMfaServiceToken(tenantId, ClientAppId, clientSecret);
    console.log('MFA Service Token:', mfaServiceToken);

    const getPrincipalId =  await getServicePrincipalId(accessToken);
    console.log('Service Principal ID:', getPrincipalId);





    // Step 4: Store MFA request details in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (supabaseUrl && supabaseServiceKey) {
      try {
        console.log('Storing MFA request in database');
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
            tenant_id: tenantId,
            mfa_token: mfaToken,
            user_id: null
          })
        });

        if (!response.ok) {
          console.error('Failed to insert reset request:', await response.text());
        } else {
          console.log('Successfully stored MFA request');
        }
      } catch (error) {
        console.error('Error inserting reset request:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `MFA push notification sent to ${email}`,
        contextId: 'sadsad'
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
        error: error instanceof Error ? error.message : 'Unknown error during MFA process'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});



// $servicePrincipalId = (Get-MgServicePrincipal -Filter "appid eq '981f26a1-7f43-403b-a875-f8b09b8cd720'").Id

// Get Service Principal ID

// Function to get Service Principal ID by appId
const getServicePrincipalId = async (accessToken : string) => {
  // const ClientAppId = '981f26a1-7f43-403b-a875-f8b09b8cd720'; // Entra Id MFA Notification Client App ID
  try {
    // Request URL to get service principal by appId
    const url = `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '809efbcb-4d5e-4f17-adb1-cddb49f98f30'`;

    // Set up the request headers
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Make the GET request to Microsoft Graph API
    const response = await fetch(url, { headers });
    console.log('Response:', response);

    // Check if the response is ok (status 200)
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error fetching service principal: ${errorData.error.message}`);
    }

    // Parse the response JSON to get service principal details
    const data = await response.json();
    console.log('Service Principal Data:', data);

    // Log and return the service principal ID
    if (data.value && data.value.length > 0) {
      const servicePrincipalId = data.value[0].id;
      console.log('Service Principal ID:', servicePrincipalId);
      return servicePrincipalId;
    } else {
      throw new Error('Service principal not found');
    }
  } catch (error) {
    console.error('Error getting service principal ID:', error);
    throw error;
  }
};

const getMfaServiceToken = async (tenantId: string, clientId: string, clientSecret: string) => {
  try {
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      'client_id': clientId,
      'client_secret': clientSecret,
      'scope': 'https://graph.microsoft.com/.default',
      'grant_type': 'client_credentials',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error fetching MFA service token: ${errorData.error_description}`);
    }

    const data = await response.json();
    const mfaServiceToken = data.access_token;
    console.log('MFA Service Token:', mfaServiceToken);
    return mfaServiceToken;
  } catch (error) {
    console.error('Error getting MFA service token:', error);
    throw error;
  }
};
