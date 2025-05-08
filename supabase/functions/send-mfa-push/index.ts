import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received request to send MFA push notification");
    const body = await req.json();
    body.tenantId = "db265c9f-9e82-4ad3-ad5c-b5435ba0a6d9";

    const { email, accessToken, tenantId } = body;

    // Validate incoming data
    if (!email || !accessToken || !tenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required parameters",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // # Get ID of 'Entra Id MFA Notification Client' Service Principal
    // $servicePrincipalId = (Get-MgServicePrincipal -Filter "appid eq '981f26a1-7f43-403b-a875-f8b09b8cd720'").Id
    // const ClientAppId = '809efbcb-4d5e-4f17-adb1-cddb49f98f30'; // Entra Id MFA Notification Client App ID

    // step 1: Create a client secret for the service principal
    const mfaServiceToken = await getMfaServiceToken();
    console.log("MFA Service Token:", mfaServiceToken);

    // step 2: Create a client secret for the service principal
    // const servicePrincipalId = await getServicePrincipalId(mfaServiceToken);
    // console.log('Service Principal ID:', servicePrincipalId);

    // step 3: Create a client secret for the service principal
    // const mfaSecret = await createMfaClientSecret(mfaServiceToken, servicePrincipalId);
    // console.log('MFA Client Secret:', mfaSecret);

    const contextId = crypto.randomUUID();

    // step 4: Get the MFA token using the client secret
    const result = await sendMfaNotification(email, mfaServiceToken, contextId);
    console.log("MFA notification result:", result);
    // step 5: Parse the XML response
    const mfaOutcome = parseMfaResponse(result);

    // Step 4: Store MFA request details in Supabase if needed
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (supabaseUrl && supabaseServiceKey) {
      try {
        console.log("Storing MFA request in database");
        const response = await fetch(`${supabaseUrl}/rest/v1/change_requests`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            user_email: email,
            status: "pending",
            notification_sent: true,
            context_id: contextId,
            user_id: null,
          }),
        });

        if (!response.ok) {
          console.error(
            "Failed to insert reset request:",
            await response.text()
          );
        } else {
          console.log("Successfully stored MFA request");
        }
      } catch (error) {
        console.error("Error inserting reset request:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `MFA push notification sent to ${email}`,
        contextId: contextId,
        result: mfaOutcome,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in MFA process:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during MFA process",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// $servicePrincipalId = (Get-MgServicePrincipal -Filter "appid eq '981f26a1-7f43-403b-a875-f8b09b8cd720'").Id

// Get Service Principal ID

// Function to get Service Principal ID by appId
const getServicePrincipalId = async (mfaServiceToken: string) => {
  // const ClientAppId = '981f26a1-7f43-403b-a875-f8b09b8cd720'; // Entra Id MFA Notification Client App ID
  try {
    // Request URL to get service principal by appId
    const url = `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '981f26a1-7f43-403b-a875-f8b09b8cd720'`;

    // Set up the request headers
    const headers = {
      Authorization: `Bearer ${mfaServiceToken}`,
      "Content-Type": "application/json",
    };

    // Make the GET request to Microsoft Graph API
    const response = await fetch(url, { headers });
    console.log("Response:", response);

    // Check if the response is ok (status 200)
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Error fetching service principal: ${errorData.error.message}`
      );
    }

    // Parse the response JSON to get service principal details
    const data = await response.json();
    console.log("Service Principal Data:", data);

    // Log and return the service principal ID
    if (data.value && data.value.length > 0) {
      const servicePrincipalId = data.value[0].id;
      console.log("Service Principal ID:", servicePrincipalId);
      return servicePrincipalId;
    } else {
      throw new Error("Service principal not found");
    }
  } catch (error) {
    console.error("Error getting service principal ID:", error);
    throw error;
  }
};

// Function to get a token for the MFA service
const getMfaServiceToken = async () => {
  const tenantId = "a18efd2c-d866-4a6d-89be-cc85869862a2"; // Your Azure AD tenant ID
  const clientId = "981f26a1-7f43-403b-a875-f8b09b8cd720"; // Your Azure AD application ID
  const clientSecret = "y9w8Q~t9EFiOaob3iKPa~MlvHuHftlybSO9mUdx~"; // Your Azure AD application secret
  try {
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/token`;
    const params = new URLSearchParams({
      resource:
        "https://adnotifications.windowsazure.com/StrongAuthenticationService.svc/Connector",
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "openid",
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get MFA token: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error getting MFA token:", error);
    throw error;
  }
};

const createMfaClientSecret = async (
  mfaServiceToken: string,
  servicePrincipalId: string
) => {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}/addPassword`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mfaServiceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passwordCredential: {
          displayName: "account change approval",
        },
      }),
    }
  );
  console.log("Create client secret response:", response);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Error creating client secret:", errorText);
    throw new Error("Failed to create client secret");
  }

  const secretData = await response.json();
  return secretData.secretText;
};

// Function to send MFA notification
async function sendMfaNotification(
  email: string,
  mfaServiceToken: string,
  contextId: string
) {
  const mfaXML = `
    <BeginTwoWayAuthenticationRequest>
      <Version>1.0</Version>
      <UserPrincipalName>${email}</UserPrincipalName>
      <Lcid>en-us</Lcid>
      <AuthenticationMethodProperties xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
        <a:KeyValueOfstringstring>
          <a:Key>OverrideVoiceOtp</a:Key>
          <a:Value>false</a:Value>
        </a:KeyValueOfstringstring>
      </AuthenticationMethodProperties>
      <ContextId>${contextId}</ContextId>
      <SyncCall>true</SyncCall>
      <RequireUserMatch>true</RequireUserMatch>
      <CallerName>radius</CallerName>
      <CallerIP>UNKNOWN:</CallerIP>
    </BeginTwoWayAuthenticationRequest>
  `;

  const response = await fetch(
    "https://strongauthenticationservice.auth.microsoft.com/StrongAuthenticationService.svc/Connector/BeginTwoWayAuthentication",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Authorization: `Bearer ${mfaServiceToken}`,
      },
      body: mfaXML,
    }
  );

  console.log("MFA notification response:", response);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to send MFA request: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.text();
}

// Helper function to parse the XML response
function parseMfaResponse(xmlString: string) {
  // In a production environment, use a proper XML parser
  // This is a simple implementation to extract basic status info

  const result = {
    received: false,
    approved: false,
    denied: false,
    timeout: false,
    message: "",
  };

  try {
    // Look for common result patterns
    result.received =
      xmlString.includes("AuthenticationResult") &&
      xmlString.includes("BeginTwoWayAuthenticationResponse");
    result.approved = xmlString.includes("<Value>Success</Value>");
    result.denied = xmlString.includes("<Value>PhoneAppDenied</Value>");
    result.timeout = xmlString.includes("<Value>PhoneAppNoResponse</Value>");

    // Extract message if possible
    const messageMatch = xmlString.match(/<Message>(.*?)<\/Message>/);
    if (messageMatch && messageMatch[1]) {
      result.message = messageMatch[1];
    }
  } catch (error) {
    console.error("Error parsing MFA response:", error);
  }

  return result;
}
