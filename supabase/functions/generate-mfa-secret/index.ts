// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    // This is an internal service function - called by manage-user which handles authorization
    const body = await req.json();
    const { tenantId, clientId, accessToken, userDetails, organizationId } = body;

    // Validate incoming data
    if (!tenantId || !clientId || !accessToken || !userDetails || !organizationId) {
      return createErrorResponse(
        "Missing required parameters: tenantId, clientId, accessToken, userDetails, or organizationId",
        400
      );
    }

    try {
      // Create the client secret
      const secretResult = await createMfaClientSecret(accessToken, tenantId);
      
      // Store the secret in Supabase
      await storeMfaSecret(tenantId, clientId, secretResult, userDetails.email || "unknown", accessToken, organizationId);
      
      // Return success response
      return createSuccessResponse({
        message: "MFA client secret generated and stored successfully",
        secretId: secretResult.keyId,
        expiresAt: secretResult.expiresAt
      });

    } catch (error) {
      console.error("Error in MFA secret generation:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unknown error during MFA secret generation",
        500
      );
    }

  } catch (error) {
    console.error("Error parsing request:", error);
    return createErrorResponse("Invalid request format", 400);
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
      displayName: "AuthenPush Client Secret",
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
    startDateTime: secretData.startDateTime,
    servicePrincipalId: servicePrincipalId 
  };
}

// Function to store MFA secret in Supabase
async function storeMfaSecret(tenantId: any, clientId: any, secretData: { secretValue: any; keyId: any; displayName: any; expiresAt: any; startDateTime?: any; servicePrincipalId: any; }, createdBy: any, accessToken: any, organizationId: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const encryptionKey = Deno.env.get("MFA_SECRET_ENCRYPTION_KEY") || tenantId;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("Supabase credentials not configured, skipping database storage");
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Step 1: Get existing secret for this organization
    const { data: existingSecret, error: fetchError } = await supabase
      .from("mfa_secrets")
      .select("id, key_id, sp_id")
      .eq("organization_id", organizationId)
      .single(); // Use single() since there should be only one per organization
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error fetching existing secret:", fetchError);
    }
    
    // Step 2: If there's an existing secret, delete it from Azure first
    if (existingSecret && existingSecret.key_id && existingSecret.sp_id) {
      await deleteSecretFromAzure(accessToken, existingSecret.key_id, existingSecret.sp_id);
      
      // Delete the old secret from database
      const { error: deleteError } = await supabase
        .from("mfa_secrets")
        .delete()
        .eq("id", existingSecret.id);
      
      if (deleteError) {
        console.error("Error deleting old secret from database:", deleteError);
        // Continue anyway - we'll insert the new one
      }
    }
    
    // Step 3: Encrypt and store the new secret
    const encryptedSecretValue = await encryptData(secretData.secretValue, encryptionKey);
    
    // Step 4: Insert the new secret
    const { data: newSecretData, error: insertError } = await supabase
      .from("mfa_secrets")
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        organization_id: organizationId,
        secret_value: encryptedSecretValue,
        key_id: secretData.keyId,
        display_name: secretData.displayName,
        created_at: new Date().toISOString(),
        expires_at: secretData.expiresAt,
        created_by: createdBy,
        sp_id: secretData.servicePrincipalId,
      })
      .select("id");
    
    if (insertError) {
      console.error("Error storing MFA secret:", insertError);
      throw new Error("Failed to store MFA secret in database");
    }
    
    
  } catch (error) {
    console.error("Error in storeMfaSecret:", error);
    throw error;
  }
}

// Function to delete a secret from Azure (optimized version - no API call needed)
async function deleteSecretFromAzure(accessToken: any, keyId: string, servicePrincipalId: string) {
  if (!keyId || !servicePrincipalId) {
    console.warn("Missing keyId or servicePrincipalId for Azure secret deletion");
    return;
  }
  
  try {
    
    // Delete the password credential directly using stored service principal ID
    const deleteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals/${servicePrincipalId}/removePassword`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keyId: keyId
        })
      }
    );

    // Check if the deletion was successful
    console.log("Delete response status:", deleteResponse.status);
    console.log("Delete response text:", await deleteResponse.text());
    
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error(`Failed to delete secret ${keyId} from Azure:`, errorText);
      // Don't throw here - we want to continue with database operations
    }
    
  } catch (error) {
    console.error(`Error deleting secret ${keyId} from Azure:`, error);
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
