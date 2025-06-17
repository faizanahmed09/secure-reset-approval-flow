/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { LogLevel } from "@azure/msal-browser";

/**
 * MSAL Configuration for Azure AD authentication
 */
export const msalConfig = {
    auth: {
        clientId: "aad5399a-e678-4857-80be-a1664910d86a",
        authority: "https://login.microsoftonline.com/organizations",
        redirectUri: (typeof window !== "undefined" ? `${window.location.origin}/auth-callback` : "http://localhost:3000/auth-callback"),
        postLogoutRedirectUri: ( typeof window !== "undefined" ? `${window.location.origin}/` : "http://localhost:3000/"),
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
                        console.error(message);
                        return;
                    case LogLevel.Info:
                        console.info(message);
                        return;
                    case LogLevel.Verbose:
                        console.debug(message);
                        return;
                    case LogLevel.Warning:
                        console.warn(message);
                        return;
                    default:
                        return;
                }	
            }	
        }	
    }
};

/**
 * Login request configuration
 */
export const loginRequest = {
    scopes: [
        "User.Read",
        "User.Read.All",
        "https://graph.microsoft.com/CrossTenantInformation.ReadBasic.All"
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
