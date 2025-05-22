// ignore all typescript errors
// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req: { method: string; json: () => any; })=>{
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
async function createMfaClientSecret(accessToken: any, tenantId: any) {
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
async function storeMfaSecret(tenantId: any, secretData: { secretValue: any; keyId: any; displayName: any; expiresAt: any; startDateTime?: any; }, createdBy: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const encryptionKey = Deno.env.get("MFA_SECRET_ENCRYPTION_KEY") || tenantId; // Fallback to tenantId if no key defined
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Supabase credentials not configured, skipping database storage");
    return;
  }
  try {
    // Encrypt the secret value
    const encryptedSecretValue = await encryptData(secretData.secretValue, encryptionKey);
    // Store the encrypted secret value

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Mark any existing active secrets for this tenant as inactive
    await supabase.from("mfa_secrets").update({
      is_active: false
    }).eq("tenant_id", tenantId).eq("is_active", true);
    // Insert the new secret
    const { data, error } = await supabase.from("mfa_secrets").insert({
      tenant_id: tenantId,
      client_id: Deno.env.get("MFA_CLIENT_ID") || "",
      secret_value: encryptedSecretValue,
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

// Function to encrypt sensitive data
async function encryptData(plaintext: string, secretKey: string) {
  // Convert the secret key to a crypto key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey.padEnd(32, 'x').slice(0, 32)); // Ensure key is 32 bytes
  
  // Generate a random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Import the key
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  
  // Combine IV and encrypted data and convert to base64
  const encryptedArray = new Uint8Array(iv.length + encryptedData.byteLength);
  encryptedArray.set(iv, 0);
  encryptedArray.set(new Uint8Array(encryptedData), iv.length);
  
  return btoa(String.fromCharCode(...encryptedArray));
}
