
import { Configuration, RedirectRequest } from "@azure/msal-browser";

// Check if we're running on the client side
const isClient = typeof window !== 'undefined';

// Get stored Azure AD credentials from localStorage or use defaults
const getStoredClientId = (): string => {
  if (isClient) {
    return localStorage.getItem('azureClientId') || "809efbcb-4d5e-4f17-adb1-cddb49f98f30";
  }
  return "809efbcb-4d5e-4f17-adb1-cddb49f98f30"; // Default client ID
};

const getStoredTenantId = (): string => {
  if (isClient) {
    return localStorage.getItem('azureTenantId') || "db265c9f-9e82-4ad3-ad5c-b5435ba0a6d9";
  }
  return "db265c9f-9e82-4ad3-ad5c-b5435ba0a6d9"; // Default tenant ID
};

// Authentication configuration for Microsoft Authentication Library (MSAL)
export const msalConfig: Configuration = {
  auth: {
    clientId: getStoredClientId(), // Get from localStorage or use default
    authority: `https://login.microsoftonline.com/${getStoredTenantId()}`, // Get from localStorage or use default
    redirectUri: isClient ? window.location.origin : "http://localhost:3000", // Uses the current URL as redirect URI
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// The scopes request for authentication
export const loginRequest: RedirectRequest = {
  scopes: [
    'User.ReadWrite.All',  // Modify user data permissions
    'Directory.ReadWrite.All',  // Directory-related changes
    'offline_access',  // To get refresh tokens
    'openid',  // OpenID Connect (required for authentication)
    'profile',  // User's profile data
    'email',  // Access to the email data
    'UserAuthenticationMethod.ReadWrite.All',  // Read and write access to user authentication methods
    'https://graph.microsoft.com/Mail.ReadWrite',  // Read and write access to user email
    'https://graph.microsoft.com/Directory.ReadWrite.All', // Directory access permissions
  ]
};

// Microsoft Graph API endpoint
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphUsersEndpoint: "https://graph.microsoft.com/v1.0/users",
};
