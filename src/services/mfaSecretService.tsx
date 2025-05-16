import { jwtDecode } from "jwt-decode";

const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co";

// Check if a valid MFA secret exists for the tenant
export async function checkMfaSecret(accessToken: string, idToken: string) {
  try {
    // Decode the token to extract user details
    const decodedToken : any = jwtDecode(idToken);
    
    const userDetails = {
      name: decodedToken.name || null,
      email: decodedToken.preferred_username || null,
      tenantId: decodedToken.tid,
      userObjectId: decodedToken.oid,
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
          tenantId: userDetails.tenantId
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
      return await generateNewMfaSecret(accessToken, userDetails);
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

// Generate a new MFA secret
async function generateNewMfaSecret(accessToken: string, userDetails: any) {
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