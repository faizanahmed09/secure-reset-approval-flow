import { jwtDecode } from "jwt-decode";
import { IPublicClientApplication, AuthenticationResult } from "@azure/msal-browser";
import { loginRequest } from '../userAuthConfig';

const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co";

/**
 * Centralized function to get access token with fallback mechanisms
 * First tries session storage, then falls back to MSAL silent token acquisition
 */
export const getAccessToken = async (
  instance: IPublicClientApplication,
  accounts: any[]
): Promise<string> => {
  // First try to get token from session storage
  if (typeof window !== 'undefined') {
    const storedToken = window.sessionStorage.getItem('accessToken');
    if (storedToken) {
      return storedToken;
    }
  }

  // Fall back to MSAL if no stored token and accounts are available
  if (accounts.length > 0) {
    try {
      // Ensure active account is set
      if (!instance.getActiveAccount()) {
        instance.setActiveAccount(accounts[0]);
      }
      
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      
      // Store the new token for future use
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('accessToken', tokenResponse.accessToken);
      }
      
      return tokenResponse.accessToken;
    } catch (error: any) {
      // If silent token acquisition fails, clear stored token and throw error
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('accessToken');
      }
      
      // Handle specific MSAL errors
      if (error.name === "InteractionRequiredAuthError" || 
          error.errorCode === "interaction_required" ||
          error.errorCode === "consent_required" ||
          error.errorCode === "login_required") {
        throw new Error("INTERACTION_REQUIRED");
      }
      
      throw error;
    }
  }

  throw new Error("No authentication available - please refresh the page");
};

interface User {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  client_id: string;
  last_login_at: string;
  is_active: boolean;
  role: 'admin' | 'verifier' | 'basic';
  organizations?: {
    display_name: string;
  };
}

interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

/**
 * Search Azure AD users with proper error handling
 */
export const searchAzureUsers = async (
  instance: IPublicClientApplication,
  accounts: any[],
  searchQuery: string
): Promise<AzureUser[]> => {
  try {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    // Use centralized token function
    const accessToken = await getAccessToken(instance, accounts);

    const selectFields = ['id', 'displayName', 'userPrincipalName'].join(',');
    const searchFilter = `startswith(displayName,'${searchQuery}') or startswith(userPrincipalName,'${searchQuery}')`;
    
    const endpoint = `https://graph.microsoft.com/v1.0/users?$select=${selectFields}&$filter=${encodeURIComponent(searchFilter)}&$top=50`;

    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'ConsistencyLevel': 'eventual',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        // Token might be expired, clear it from session storage and throw interaction required
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem('accessToken');
        }
        throw new Error('INTERACTION_REQUIRED');
      } else if (response.status === 403) {
        throw new Error('Insufficient permissions to search users. Please contact your administrator.');
      } else {
        throw new Error(`Failed to search Azure users: ${errorData.error?.message || response.statusText}`);
      }
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error('Error searching Azure users:', error);
    throw error;
  }
};


/**
 * Create a new user in the database
 */
export const createDatabaseUser = async (
  azureUser: AzureUser,
  role: 'admin' | 'verifier' | 'basic',
  organizationId: string,
  tenantId: string,
  clientId: string
): Promise<User> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        azureUser,
        role,
        organizationId,
        tenantId,
        clientId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create user');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to create user');
    }

    return data.user;
  } catch (error) {
    console.error('Error creating database user:', error);
    throw error;
  }
};

/**
 * Fetch users for a specific organization
 */
export const fetchOrganizationUsers = async (organizationId: string): Promise<User[]> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch users');
    }

    return data.users || [];
  } catch (error) {
    console.error('Error fetching organization users:', error);
    throw error;
  }
};

/**
 * Update user status and role
 */
export const updateUser = async (
  userId: string, 
  updates: { is_active?: boolean; role?: 'admin' | 'verifier' | 'basic' }
): Promise<User> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        ...updates,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update user');
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to update user');
    }

    return data.user;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

