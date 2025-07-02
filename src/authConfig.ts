import { Configuration, RedirectRequest, LogLevel } from "@azure/msal-browser";

// Check if we're running on the client side
const isClient = typeof window !== 'undefined';

/**
 * Admin Authentication Configuration for Microsoft Authentication Library (MSAL)
 * This configuration is specifically for admin-level operations requiring elevated permissions
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: "aad5399a-e678-4857-80be-a1664910d86a",
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: isClient ? window.location.origin : "http://localhost:3000",
    postLogoutRedirectUri: isClient ? window.location.origin : "http://localhost:3000",
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    allowNativeBroker: false,
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
    allowRedirectInIframe: false,
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) return;
        
        switch (level) {
          case LogLevel.Error:
            console.error('[Admin Auth]', message);
            return;
          case LogLevel.Info:
            console.info('[Admin Auth]', message);
            return;
          case LogLevel.Verbose:
            console.debug('[Admin Auth]', message);
            return;
          case LogLevel.Warning:
            console.warn('[Admin Auth]', message);
            return;
          default:
            return;
        }
      }
    }
  }
};

/**
 * Admin login request with elevated permissions for administrative operations
 * These scopes allow full user management, directory operations, and application management
 */
export const loginRequest: RedirectRequest = {
  scopes: [
    // Microsoft Graph API scopes for admin operations
    'https://graph.microsoft.com/User.ReadWrite.All',
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/Directory.ReadWrite.All',
    'https://graph.microsoft.com/Application.ReadWrite.All',
    'https://graph.microsoft.com/UserAuthenticationMethod.ReadWrite.All',
    
    // Standard OAuth scopes
    'offline_access',
    'openid',
    'profile',
    'email',
  ],
  prompt: "select_account",
};

/**
 * Microsoft Graph API endpoints for admin operations
 */
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphUsersEndpoint: "https://graph.microsoft.com/v1.0/users",
  graphApplicationsEndpoint: "https://graph.microsoft.com/v1.0/applications",
  graphDirectoryEndpoint: "https://graph.microsoft.com/v1.0/directory",
};

/**
 * Helper function to clear admin authentication data from storage
 */
export const clearAzureAuth = () => {
  if (isClient) {
    // Clear admin-specific tokens from sessionStorage
    window.sessionStorage.removeItem('azureToken');
    window.sessionStorage.removeItem('azureTokenExpiry');
    window.sessionStorage.removeItem('idToken');
    window.sessionStorage.removeItem('accessToken');
    window.sessionStorage.removeItem('adminUser');
    window.sessionStorage.removeItem('adminProcessed');
    
    // Note: We don't clear clientId and tenantId from localStorage
    // as those are configuration settings, not authentication state
  }
};

/**
 * Get stored Azure AD credentials from localStorage (for dynamic configuration)
 */
export const getStoredClientId = (): string => {
  if (isClient) {
    return localStorage.getItem('azureClientId') || "";
  }
  return "";
};

export const getStoredTenantId = (): string => {
  if (isClient) {
    return localStorage.getItem('azureTenantId') || "";
  }
  return "";
};
