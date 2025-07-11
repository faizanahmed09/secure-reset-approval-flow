import { Configuration, RedirectRequest, LogLevel } from "@azure/msal-browser";

/**
 * MSAL Configuration for Azure AD authentication
 */
export const msalConfig: Configuration = {
    auth: {
        clientId: "aad5399a-e678-4857-80be-a1664910d86a",
        authority: "https://login.microsoftonline.com/organizations",
        redirectUri: (typeof window !== "undefined" ? `${window.location.origin}/auth-callback` : "http://localhost:3000/auth-callback"),
        postLogoutRedirectUri: "https://authenpush.com",
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
    }
};

/**
 * Login request configuration
 * Using .default scope to request all permissions configured in the Azure AD app registration
 * This simplifies permission management and uses the minimum required permissions:
 * - Application.ReadWrite.All = Manage client secret for Azure MFA App
 * - openid = Single Sign On
 * - User.ReadBasic.All = Read Name, UserPrincipalName, email for user search and push notifications
 * - UserAuthenticationMethod.ReadWrite.All = Read MFA methods and change default MFA method
 */
export const loginRequest = {
    scopes: [
        "https://graph.microsoft.com/.default"
    ],
    prompt: "select_account",
    responseMode: "fragment",
    responseType: "id_token token"
};


/**
 * Microsoft Graph API configuration
 */
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
    graphUsersEndpoint: "https://graph.microsoft.com/v1.0/users",
};

/**
 * Helper function to clear authentication data from session storage
 */
export const clearAzureAuth = () => {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('idToken');
        window.sessionStorage.removeItem('accessToken');
        window.sessionStorage.removeItem('currentUser');
        window.sessionStorage.removeItem('userProcessed');
        window.sessionStorage.removeItem('mfaSecretChecked');
    }
};
