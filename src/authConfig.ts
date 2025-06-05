
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
    // authority: 'https://login.microsoftonline.com/common',
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
    // These need to be prefixed with https://graph.microsoft.com/
    'https://graph.microsoft.com/User.ReadWrite.All',
    'https://graph.microsoft.com/Directory.ReadWrite.All',
    'https://graph.microsoft.com/Application.ReadWrite.All',
    'https://graph.microsoft.com/UserAuthenticationMethod.ReadWrite.All',
    'https://graph.microsoft.com/Mail.ReadWrite',
    
    // These are Azure AD standard scopes and are correct as is
    'offline_access',
    'openid',
    'profile',
    'email',
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
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('azureToken');
      window.sessionStorage.removeItem('azureTokenExpiry');
    }
    // Note: We don't clear the clientId and tenantId from localStorage
    // as those are configuration settings, not authentication state
  }
};
