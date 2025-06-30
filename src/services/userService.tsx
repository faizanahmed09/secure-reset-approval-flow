import { jwtDecode } from "jwt-decode";
import { IPublicClientApplication, AuthenticationResult } from "@azure/msal-browser";
import { tokenInterceptor } from '@/utils/tokenInterceptor';

const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co";

/**
 * Centralized function to get access token using the token interceptor
 * This will automatically handle token refresh and expiration
 */
export const getAccessToken = async (
  instance: IPublicClientApplication,
  accounts: any[]
): Promise<string> => {
  try {
    // Initialize the token interceptor with current MSAL instance and accounts
    tokenInterceptor.initialize(instance, accounts);
      
    // Use the token interceptor to get a valid token
    return await tokenInterceptor.getValidAccessToken();
    } catch (error: any) {
    console.error('Error getting access token:', error);
    
    // Handle the error through the token interceptor
    tokenInterceptor.handleGraphApiError(error, 'getAccessToken');
    
    // Re-throw for component-level handling
      throw error;
  }
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
 * Search Azure AD users with proper error handling using token interceptor
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

    // Initialize the token interceptor
    tokenInterceptor.initialize(instance, accounts);

    const selectFields = ['id', 'displayName', 'userPrincipalName'].join(',');
    const searchFilter = `startswith(displayName,'${searchQuery}') or startswith(userPrincipalName,'${searchQuery}')`;
    
    const endpoint = `https://graph.microsoft.com/v1.0/users?$select=${selectFields}&$filter=${encodeURIComponent(searchFilter)}&$top=50`;

    // Use token interceptor's fetch method for automatic token handling
    const response = await tokenInterceptor.graphApiFetch(endpoint, {
      headers: {
        'ConsistencyLevel': 'eventual',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 403) {
        throw new Error('Insufficient permissions to search users. Please contact your administrator.');
      } else {
        throw new Error(`Failed to search Azure users: ${errorData.error?.message || response.statusText}`);
      }
    }

    const data = await response.json();
    return data.value || [];
  } catch (error: any) {
    console.error('Error searching Azure users:', error);
    
    // Handle the error through the token interceptor
    tokenInterceptor.handleGraphApiError(error, 'searchAzureUsers');
    
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

/**
 * Delete a user from the database
 */
export const deleteUser = async (userId: string, adminEmail: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, adminEmail }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to delete user');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new Error(error.message || 'An unexpected error occurred');
  }
};

