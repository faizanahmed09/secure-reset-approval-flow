// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get the client secret from the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Server configuration error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the active secret for this tenant
    const { data: secretData, error: secretError } = await supabase
      .from("mfa_secrets")
      .select("secret_value")
      .eq("tenant_id", userDetails.tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // More specific error messaging for missing secret
    if (secretError) {
      if (secretError.code === 'PGRST116') {
        // This is the "no rows returned" error code from PostgREST
        return new Response(
          JSON.stringify({
            success: false,
            message: "No MFA secret found for this tenant. Please generate one first by visiting the configuration page.",
            error_code: "NO_MFA_SECRET"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Other database errors
        return new Response(
          JSON.stringify({
            success: false,
            message: "Database error when retrieving MFA secret.",
            error_code: "DB_ERROR",
            details: secretError.message
          }),
          {
            status: 500, 
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Also handle where no error but data is empty
    if (!secretData || !secretData.secret_value) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No valid MFA secret value found. Please generate a new secret.",
          error_code: "EMPTY_SECRET"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const encryted_clientSecret = secretData.secret_value;

    const tenantId = userDetails.tenantId
    const clientId = Deno.env.get("MFA_CLIENT_ID") || "";
    
    try {

      // Get the encryption key from environment variable
      const encryptionKey = Deno.env.get("MFA_SECRET_ENCRYPTION_KEY") || tenantId;

      // Decrypt the secret
      const clientSecret = await decryptData(encryted_clientSecret, encryptionKey);

      // Step 1: Get MFA service token
      const mfaServiceToken = await getMfaServiceToken(tenantId, clientId, clientSecret);

      // Step 2: Create a unique context ID
      const contextId = crypto.randomUUID();

      // Step 3: Send the MFA notification
      const result = await sendMfaNotification(email, mfaServiceToken, contextId);
      // // Step 4: Parse the XML response
      const mfaOutcome = parseMfaResponse(result);

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
        tenant_id: userDetails.tenantId || null,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to insert request record:", errorText);
      throw new Error("Failed to store request data in database");
    }

  } catch (error) {
    console.error("Error inserting request:", error);
    // We don't throw here since this is a non-critical operation
  }
}

// Function to decrypt sensitive data (used when retrieving the secret)
async function decryptData(encryptedBase64: string, secretKey: string) {
  // Convert the secret key to a crypto key
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const keyData = encoder.encode(secretKey.padEnd(32, 'x').slice(0, 32)); // Ensure key is 32 bytes
  
  // Convert base64 to array
  const encryptedArray = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = encryptedArray.slice(0, 12);
  const encryptedData = encryptedArray.slice(12);
  
  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  // Decrypt the data
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encryptedData
  );
  
  return decoder.decode(decryptedData);
}