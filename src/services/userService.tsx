import { jwtDecode } from "jwt-decode";

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

export async function handleUserOnRedirect() {
  try {
    // Prevent multiple simultaneous calls
    if (isProcessing) {
      console.log("User processing already in progress, skipping...");
      return null;
    }

    // Check if we have an id_token in the URL fragment
    if (typeof window === 'undefined') return null;
    
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.substring(1));
    const idToken = urlParams.get('id_token');
    console.log("ID Token from URL:", idToken);
    
    if (!idToken) {
      console.log("No id_token found in URL");
      return null;
    }

    // Set processing flag
    isProcessing = true;

    // Clean up the URL immediately to prevent re-processing
    window.history.replaceState(null, '', window.location.pathname);

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
      tokenExpiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000) : null
    };
    
    console.log("Processing user from token:", userInfo);

    if (!userInfo.email) {
      throw new Error("No email found in token");
    }

    // Call the edge function to handle user creation/verification
    const response = await fetch(
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to process user");
    }

    const result = await response.json();
    
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