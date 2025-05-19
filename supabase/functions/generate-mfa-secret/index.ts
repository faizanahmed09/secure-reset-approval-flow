import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const { tenantId, accessToken, userDetails } = body;
    // Validate incoming data
    if (!tenantId || !accessToken || !userDetails) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required parameters: tenantId, accessToken, or userDetails"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    try {
      // Create the client secret
      const secretResult = await createMfaClientSecret(accessToken, tenantId);
      // Store the secret in Supabase
      await storeMfaSecret(tenantId, secretResult, userDetails.email || "unknown");
      // Return success response
      return new Response(JSON.stringify({
        success: true,
        message: "MFA client secret generated and stored successfully",
        secretId: secretResult.keyId,
        expiresAt: secretResult.expiresAt
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      console.error("Error in MFA secret generation:", error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during MFA secret generation"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    console.error("Error parsing request:", error);
    return new Response(JSON.stringify({
      success: false,
      message: "Invalid request format"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
// Function to create MFA client secret
async function createMfaClientSecret(accessToken, tenantId) {
  // Step 1: Get the service principal ID for MFA application
  const mfaAppId = Deno.env.get("MFA_CLIENT_ID") || "";
  
  const spResponse = await fetch(`https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${mfaAppId}'`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  if (!spResponse.ok) {
    const errorData = await spResponse.text();
    throw new Error(`Failed to get service principal: ${errorData}`);
  }
  const spData = await spResponse.json();
  if (!spData.value || spData.value.length === 0) {
    throw new Error("MFA application service principal not found in tenant");
  }
  const servicePrincipalId = spData.value[0].id;
  // Step 2: Create a new password credential (client secret)
  const credentialParams = {
    passwordCredential: {
      displayName: "SaaS App MFA Client Secret",
      endDateTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }
  };
  const createSecretResponse = await fetch(`https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}/addPassword`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentialParams)
  });
  if (!createSecretResponse.ok) {
    const errorText = await createSecretResponse.text();
    throw new Error(`Failed to create client secret: ${errorText}`);
  }
  const secretData = await createSecretResponse.json();
  // Return the relevant secret information
  return {
    secretValue: secretData.secretText,
    keyId: secretData.keyId,
    displayName: secretData.displayName,
    expiresAt: secretData.endDateTime,
    startDateTime: secretData.startDateTime
  };
}
// Function to store MFA secret in Supabase
async function storeMfaSecret(tenantId, secretData, createdBy) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Supabase credentials not configured, skipping database storage");
    return;
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Mark any existing active secrets for this tenant as inactive
    await supabase.from("mfa_secrets").update({
      is_active: false
    }).eq("tenant_id", tenantId).eq("is_active", true);
    // Insert the new secret
    const { data, error } = await supabase.from("mfa_secrets").insert({
      tenant_id: tenantId,
      client_id: "981f26a1-7f43-403b-a875-f8b09b8cd720",
      secret_value: secretData.secretValue,
      key_id: secretData.keyId,
      display_name: secretData.displayName,
      created_at: new Date().toISOString(),
      expires_at: secretData.expiresAt,
      created_by: createdBy,
      is_active: true
    }).select("id");
    if (error) {
      console.error("Error storing MFA secret:", error);
      throw new Error("Failed to store MFA secret in database");
    }
  } catch (error) {
    console.error("Error storing MFA secret:", error);
    throw error;
  }
}
