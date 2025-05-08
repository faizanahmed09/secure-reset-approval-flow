
import { Configuration, RedirectRequest } from "@azure/msal-browser";

// Check if we're running on the client side
const isClient = typeof window !== 'undefined';

// Get stored Azure AD credentials from localStorage without defaults
const getStoredClientId = (): string => {
  if (isClient) {
    return localStorage.getItem('azureClientId') || "";
  }
  return ""; // No default client ID
};

const getStoredTenantId = (): string => {
  if (isClient) {
    return localStorage.getItem('azureTenantId') || "";
  }
  return ""; // No default tenant ID
};

// Authentication configuration for Microsoft Authentication Library (MSAL)
export const msalConfig: Configuration = {
  auth: {
    clientId: getStoredClientId(), // Get from localStorage without default
    authority: `https://login.microsoftonline.com/${getStoredTenantId()}`, // Get from localStorage without default
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

// Helper function to clear all Azure-related items from localStorage on logout
export const clearAzureAuth = () => {
  if (isClient) {
    // Clear tokens from sessionStorage
    sessionStorage.removeItem('azureToken');
    sessionStorage.removeItem('azureTokenExpiry');
    
    // Note: We don't clear the clientId and tenantId from localStorage
    // as those are configuration settings, not authentication state
  }
};
