import { jwtDecode } from "jwt-decode";
import { IPublicClientApplication, AuthenticationResult } from "@azure/msal-browser";

const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co";

interface MicrosoftTokenPayload {
  aud?: string;
  iss?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  aio?: string;
  nonce?: string;
  rh?: string;
  sub?: string;
  tid?: string;
  uti?: string;
  ver?: string;
  [key: string]: any;
}

let isProcessing = false; // Add a processing flag to prevent multiple calls

export async function handleUserOnRedirect(authResponse?: AuthenticationResult | null, msalInstance?: IPublicClientApplication) {
  try {
    // Prevent multiple simultaneous calls
    if (isProcessing) {
      console.log("User processing already in progress, skipping...");
      return null;
    }

    if (typeof window === 'undefined') return null;
    
    let finalAuthResponse = authResponse;
    
    // If no authResponse provided and no msalInstance, try to get from URL hash (legacy behavior)
    if (!finalAuthResponse && !msalInstance) {
      console.log("No auth response or MSAL instance provided, checking URL hash...");
      const hash = window.location.hash;
      if (!hash.includes('id_token=')) {
        console.log("No id_token in URL hash");
        return null;
      }
      // For legacy URL hash handling, we would need to parse the hash manually
      // But this is not recommended - better to use MSAL instance
      return null;
    }
    
    // If we have an MSAL instance but no auth response, handle redirect promise
    if (!finalAuthResponse && msalInstance) {
      console.log("Handling redirect promise with MSAL instance...");
      finalAuthResponse = await msalInstance.handleRedirectPromise();
    }
    
    if (!finalAuthResponse) {
      console.log("No response from MSAL redirect");
      return null;
    }

    // Set processing flag
    isProcessing = true;

    // Get the ID token from the response
    const idToken = finalAuthResponse.idToken;
    console.log("ID Token from MSAL:", idToken);

    if (!idToken) {
      console.log("No id_token in MSAL response");
      return null;
    }

    // Decode the ID token to extract user information
    const decodedToken = jwtDecode<MicrosoftTokenPayload>(idToken);
    console.log("Decoded token:", decodedToken);

    const userInfo = {
      email: decodedToken.preferred_username || decodedToken.email || "",
      name: decodedToken.name || "",
      tenantId: decodedToken.tid || "",
      objectId: decodedToken.oid || decodedToken.sub || "",
      clientId: decodedToken.aud || "",
      token: idToken,
      tokenExpiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000) : null,
      accessToken: finalAuthResponse.accessToken
    };

    console.log("Processing user from token:", userInfo);

    if (!userInfo.email) {
      throw new Error("No email found in token");
    }

    // Store the access token in session storage
    if (finalAuthResponse.accessToken) {
      window.sessionStorage.setItem('accessToken', finalAuthResponse.accessToken);
    }

    // Call the edge function to handle user creation/verification
    const apiResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/manage-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userInfo
        }),
      }
    );

    if (!apiResponse.ok) {
      const error = await apiResponse.json();
      throw new Error(error.message || "Failed to process user");
    }

    const result = await apiResponse.json();
    
    // Store user info in sessionStorage for app use
    window.sessionStorage.setItem('currentUser', JSON.stringify(result.user));
    window.sessionStorage.setItem('userProcessed', 'true');

    return result;
  } catch (error) {
    console.error("Error handling user redirect:", error);
    throw error;
  } finally {
    // Always reset the processing flag
    isProcessing = false;
  }
}

export function getCurrentUser() {
  if (typeof window !== 'undefined') {
    const userStr = window.sessionStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
}

export function isUserProcessed() {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('userProcessed') === 'true';
  }
  return false;
}

export function clearUserSession() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('currentUser');
    window.sessionStorage.removeItem('userProcessed');
    window.sessionStorage.removeItem('mfaSecretChecked');
    // Reset the processing flag when clearing session
    isProcessing = false;
  }
}