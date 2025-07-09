import { jwtDecode } from "jwt-decode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lbyvutzdimidlzgbjstz.supabase.co";

// Check if a valid MFA secret exists for the organization
export async function checkMfaSecret(accessToken: string, idToken: string, organizationId: string) {
  try {
    // Decode the token to extract user details
    const decodedToken : any = jwtDecode(idToken);
    
    const userDetails = {
      name: decodedToken.name || null,
      email: decodedToken.preferred_username || null,
      tenantId: decodedToken.tid,
      userObjectId: decodedToken.oid,
      clientId: decodedToken.aud || null,
    };
    
    // Call your edge function to check if a valid secret exists
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/check-mfa-secret`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          organizationId: organizationId,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error("Error checking MFA secret:", error);
      return { exists: false, secret: null, userDetails };
    }
    
    const data = await response.json();
    
    // If no valid secret exists or it's about to expire, generate a new one
    if (!data.exists || data.isExpiringSoon) {
      const reason = !data.exists ? "No MFA secret found" : "MFA secret expiring soon";
      return await generateNewMfaSecret(accessToken, userDetails, organizationId);
    }
    
    return { 
      exists: true, 
      newlyCreated: false,
      userDetails
    };
  } catch (error) {
    console.error("Error in checkMfaSecret:", error);
    throw error;
  }
}

// Generate a new MFA secret (for missing or expiring secrets)
async function generateNewMfaSecret(accessToken: string, userDetails: any, organizationId: string) {
  try {    
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-mfa-secret`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: userDetails.tenantId,
          clientId: userDetails.clientId,
          organizationId: organizationId,
          accessToken,
          userDetails
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error("Error generating MFA secret:", error);
      throw new Error(error.message || "Failed to generate MFA secret");
    }
    
    const data = await response.json();
    return {
      exists: true,
      newlyCreated: true,
      secret: {
        id: data.secretId,
        expiresAt: data.expiresAt
      },
      userDetails
    };
  } catch (error) {
    console.error("Error in generateNewMfaSecret:", error);
    throw error;
  }
}