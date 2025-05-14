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
    const { email, userDetails, accessToken } = body;

    // Validate incoming data
    if (!email || !userDetails || !accessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required parameters: email or userDetails",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Received access token (first 20 chars):", accessToken.substring(0, 20) + "...");
    // const tenantId = userDetails.tenantId;
    const tenantId = userDetails.tenantId
    const clientId = "981f26a1-7f43-403b-a875-f8b09b8cd720"; // Your Azure AD application ID
    const clientSecret = "Lb48Q~YaTyw1Z2Y.N6DiFPg9arYQEg8rUt3kgbbD"; // right now using already created secret
    try {
      // Step 1: Get MFA service token
      const mfaServiceToken = await getMfaServiceToken(tenantId, clientId, clientSecret);
      console.log("MFA Service Token obtained successfully");

      // Step 2: Create a unique context ID
      const contextId = crypto.randomUUID();

      // Step 3: Send the MFA notification
      const result = await sendMfaNotification(email, mfaServiceToken, contextId);
      // // Step 4: Parse the XML response
      const mfaOutcome = parseMfaResponse(result);
      console.log("Parsed MFA outcome:", mfaOutcome);

      // // Step 5: Store MFA request details in Supabase
      await storeMfaRequest(email, userDetails, contextId, mfaOutcome);

      // Return success response with MFA outcome
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
  } catch (error) {
    console.error("Error parsing request:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid request format",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Function to get a token for the MFA service
async function getMfaServiceToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  try {
    console.log("Getting MFA service token");
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
    throw new Error(
      error instanceof Error ? error.message : "Unknown error getting MFA token"
    );
  }
}

// Function to send MFA notification
async function sendMfaNotification(
  email: string,
  mfaServiceToken: string,
  contextId: string
): Promise<string> {
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

  try {
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

    console.log("MFA notification response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to send MFA request: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.text();
  } catch (error) {
    console.error("Error sending MFA notification:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Unknown error sending MFA notification"
    );
  }
}

// Helper function to parse the XML response
function parseMfaResponse(xmlString: string) {
  const result = {
    received: false,
    approved: false,
    denied: false,
    timeout: false,
    message: "",
  };

  try {
    // Check if we have a valid response
    result.received =
      xmlString.includes("AuthenticationResult") &&
      xmlString.includes("BeginTwoWayAuthenticationResponse");

    // Check for common status patterns
    result.approved = xmlString.includes("<Value>Success</Value>");
    result.denied = xmlString.includes("<Value>PhoneAppDenied</Value>");
    result.timeout = xmlString.includes("<Value>PhoneAppNoResponse</Value>");

    // Extract message if possible
    const messageMatch = xmlString.match(/<Message>(.*?)<\/Message>/);
    if (messageMatch && messageMatch[1]) {
      result.message = messageMatch[1];
    } else if (result.approved) {
      result.message = "User approved the request";
    } else if (result.denied) {
      result.message = "User denied the request";
    } else if (result.timeout) {
      result.message = "Request timed out - no response from user";
    }
  } catch (error) {
    console.error("Error parsing MFA response:", error);
    result.message = "Error parsing MFA response";
  }

  return result;
}

// Store MFA request details in Supabase
async function storeMfaRequest(
  email: string,
  userDetails: any,
  contextId: string,
  mfaOutcome: any
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn(
      "Supabase credentials not configured, skipping database storage"
    );
    return;
  }

  try {
    console.log("Storing MFA request in database");

    // Determine appropriate status for the database
    let status = "pending";
    if (mfaOutcome.approved) status = "approved";
    if (mfaOutcome.denied) status = "denied";
    if (mfaOutcome.timeout) status = "timeout";

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
        status: status,
        notification_sent: true,
        context_id: contextId,
        completed_at: new Date().toISOString(),
        admin_object_id: userDetails.userObjectId || null,
        admin_name: userDetails.name || null,
        admin_email: userDetails.email || null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to insert request record:", errorText);
      throw new Error("Failed to store request data in database");
    }

    console.log("Successfully stored MFA request with status:", status);
  } catch (error) {
    console.error("Error inserting request:", error);
    // We don't throw here since this is a non-critical operation
  }
}

