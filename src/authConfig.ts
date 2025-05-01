
import { Configuration } from "@azure/msal-browser";

// Authentication configuration for Microsoft Authentication Library (MSAL)
export const msalConfig: Configuration = {
  auth: {
    clientId: "YOUR_CLIENT_ID", // Replace with your Azure AD client ID
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID", // Replace with your tenant ID
    redirectUri: window.location.origin, // Uses the current URL as redirect URI
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// The scopes requested for authentication
export const loginRequest = {
  scopes: ["User.Read", "User.Read.All", "Directory.Read.All"],
};

// Microsoft Graph API endpoint
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphUsersEndpoint: "https://graph.microsoft.com/v1.0/users",
};
