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
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (secretError || !secretData?.secret_value) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No MFA secret found for this tenant. Please generate one first.",
          error_code: "NO_MFA_SECRET"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const encryptedClientSecret = secretData.secret_value;
    const tenantId = userDetails.tenantId;
    const clientId = Deno.env.get("MFA_CLIENT_ID") || "";
    
    try {
      // Get the encryption key from environment variable
      const encryptionKey = Deno.env.get("MFA_SECRET_ENCRYPTION_KEY") || tenantId;
      const clientSecret = await decryptData(encryptedClientSecret, encryptionKey);

      // NEW: Handle user preference switching
      let originalPreference = null;
      let userId = null;
      let userHasAuthenticator = false;

      try {
        // Step 1: Get user ID from email
        userId = await getUserIdFromEmail(email, accessToken);
        
        if (!userId) {
          throw new Error("User not found in Azure AD");
        }

        // Step 2: Check if user has Microsoft Authenticator
        const userMethods = await getUserAuthenticationMethods(userId, accessToken);
        userHasAuthenticator = checkIfUserHasAuthenticator(userMethods);

        if (!userHasAuthenticator) {
          const completed_at = new Date().toISOString();
          await storeMfaRequest(email, userDetails, crypto.randomUUID(), {
            received: false,
            approved: false,
            denied: false,
            timeout: false,
            mfa_not_configured: true,
            message: "User does not have Microsoft Authenticator configured"
          }, completed_at);

          return new Response(
            JSON.stringify({
              success: false,
              message: "User does not have Microsoft Authenticator configured for push notifications",
              result: {
                received: false,
                approved: false,
                denied: false,
                timeout: false,
                mfa_not_configured: true,
                message: "User does not have Microsoft Authenticator configured"
              }
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Step 3: Get and store original preference
        originalPreference = await getUserSignInPreferences(userId, accessToken);
        
        // Step 4: Temporarily set preference to push if not already
        if (originalPreference.userPreferredMethodForSecondaryAuthentication !== "push") {
          await updateUserSignInPreference(userId, "push", accessToken);
          console.log("Temporarily updated user preference to push notifications");
        }

      } catch (preferenceError) {
        console.error("Error managing user preferences:", preferenceError);
        // Continue with MFA attempt anyway, might still work
      }

      // Step 5: Get MFA service token and send notification
      const mfaServiceToken = await getMfaServiceToken(tenantId, clientId, clientSecret);
      const contextId = crypto.randomUUID();
      const result = await sendMfaNotification(email, mfaServiceToken, contextId);
      const mfaOutcome = parseMfaResponse(result);

      // Step 6: Restore original preference if we changed it
      if (originalPreference && 
          originalPreference.userPreferredMethodForSecondaryAuthentication !== "push" && 
          userId && userHasAuthenticator) {
        try {
          await updateUserSignInPreference(
            userId, 
            originalPreference.userPreferredMethodForSecondaryAuthentication, 
            accessToken
          );
          console.log("Restored original user preference:", originalPreference.userPreferredMethodForSecondaryAuthentication);
        } catch (restoreError) {
          console.error("Failed to restore original preference:", restoreError);
          // Don't fail the whole request for this
        }
      }

      // Step 7: Store MFA request details
      const completed_at = new Date().toISOString();
      await storeMfaRequest(email, userDetails, contextId, mfaOutcome, completed_at);

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
          error: error instanceof Error ? error.message : "Unknown error during MFA process",
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

// Helper function to get user ID from email
async function getUserIdFromEmail(email, accessToken) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get user ID: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

// Helper function to get user's authentication methods
async function getUserAuthenticationMethods(userId, accessToken) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userId}/authentication/methods`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get authentication methods: ${response.status}`);
  }

  const data = await response.json();
  return data.value || [];
}

// Helper function to check if user has Microsoft Authenticator
function checkIfUserHasAuthenticator(methods) {
  return methods.some(method => 
    method['@odata.type'] === '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod'
  );
}

// Helper function to get current sign-in preferences
async function getUserSignInPreferences(userId, accessToken) {
  const response = await fetch(
    `https://graph.microsoft.com/beta/users/${userId}/authentication/signInPreferences`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.ok) {
    return await response.json();
  } else {
    // Return default if not available
    return {
      userPreferredMethodForSecondaryAuthentication: "sms",
      isSystemPreferredAuthenticationMethodEnabled: false
    };
  }
}

// Helper function to update user's sign-in preference
async function updateUserSignInPreference(userId, preferredMethod, accessToken) {
  const response = await fetch(
    `https://graph.microsoft.com/beta/users/${userId}/authentication/signInPreferences`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userPreferredMethodForSecondaryAuthentication: preferredMethod
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update sign-in preference: ${response.status} ${response.statusText}`);
  }
}

// [Keep all your existing functions: getMfaServiceToken, sendMfaNotification, parseMfaResponse, storeMfaRequest, decryptData]

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
    mfa_not_configured: false,
    message: "",
  };

  try {
    // Check if we have a valid response
    result.received =
      xmlString.includes("AuthenticationResult") &&
      xmlString.includes("BeginTwoWayAuthenticationResponse");

    // Extract the AuthenticationResult value
    const authResultMatch = xmlString.match(/<AuthenticationResult>(.*?)<\/AuthenticationResult>/);
    const authResult = authResultMatch ? authResultMatch[1] : "";

    // Extract the Result Value
    const resultValueMatch = xmlString.match(/<Value>(.*?)<\/Value>/);
    const resultValue = resultValueMatch ? resultValueMatch[1] : "";

    console.log("Auth Result:", authResult, "Result Value:", resultValue);

    // ONLY approve if AuthenticationResult is "true" (actual push approval)
    result.approved = authResult === "true" || authResult === "True";
    
    // Check for denial patterns
    result.denied = xmlString.includes("<Value>PhoneAppDenied</Value>") || 
                   xmlString.includes("<Value>Denied</Value>");

    // Check for mfa not configured patterns
    result.mfa_not_configured = xmlString.includes("<Value>NoDefaultAuthenticationMethodIsConfigured</Value>")
    
    // Check for timeout patterns  
    result.timeout = xmlString.includes("<Value>PhoneAppNoResponse</Value>") ||
                    xmlString.includes("<Value>Timeout</Value>");

    // If Result Value is "Success" but AuthenticationResult is "challenge", 
    // it means SMS was sent (not what we want for push notifications)
    const isSmsChallenge = resultValue === "Success" && authResult === "challenge";

    // Extract message if possible
    const messageMatch = xmlString.match(/<Message>(.*?)<\/Message>/);
    if (messageMatch && messageMatch[1] && messageMatch[1] !== "null") {
      result.message = messageMatch[1];
    } else if (result.approved) {
      result.message = "User approved the request via push notification";
    } else if (result.denied) {
      result.message = "User denied the request";
    } else if (result.timeout) {
      result.message = "Request timed out - no response from user";
    } else if (isSmsChallenge) {
      result.message = "User has SMS MFA configured, but push notifications are not available for this user";
    } else {
      result.message = "Push notification not supported for this user's MFA configuration";
    }

    console.log("Parsed MFA result:", result);

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
  mfaOutcome: any,
  completed_at: string
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
    if (mfaOutcome.mfa_not_configured) status = "mfa_not_configured";

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
        completed_at: completed_at,
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