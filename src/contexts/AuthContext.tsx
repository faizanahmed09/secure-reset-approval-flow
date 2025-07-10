'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { IPublicClientApplication } from '@azure/msal-browser'
import { jwtDecode } from 'jwt-decode'
import { loginRequest } from '@/userAuthConfig'
import { tokenInterceptor } from '@/utils/tokenInterceptor'
import { useToast } from '@/hooks/use-toast'
import { SessionExpiredModal } from '@/components/SessionExpiredModal'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lbyvutzdimidlzgbjstz.supabase.co"

interface Organization {
  id: string;
  name: string;
  domain: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  client_id: string;
  objectId: string;
  display_name?: string;
  organization_id?: string;
  organizations?: Organization;
  role?: 'admin' | 'verifier' | 'basic';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string;
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  needsOrganizationSetup: boolean
  mfaSetupStatus: 'unknown' | 'success' | 'failed' | 'missing_service_principal'
  isSessionExpired: boolean
  refreshUser: () => Promise<void>
  updateUser: (updatedUser: User) => void
  markOrganizationSetupCompleted: () => void
  handleLoginRedirect: (instance: IPublicClientApplication) => Promise<void>
  handleLogout: (instance: IPublicClientApplication) => Promise<void>
  processUserFromToken: (idToken: string, accessToken?: string) => Promise<User | null>
  handleSessionExpiredLogin: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

// Helper function to check if user needs organization setup
const checkNeedsOrganizationSetup = (user: User | null): boolean => {
  if (!user || user.role !== 'admin') {
    return false;
  }

  // Check if organization setup has been completed or skipped in this session
  if (typeof window !== 'undefined') {
    const setupCompleted = window.sessionStorage.getItem('organizationSetupCompleted');
    if (setupCompleted === 'true') {
      return false;
    }
  }

  // Check if the organization exists
  if (!user.organizations?.id) {
    return false;
  }

  // If updated_at is different from created_at, it means someone has already updated the organization (completed setup)
  if (user.organizations.updated_at && user.organizations.created_at) {
    const updatedAt = new Date(user.organizations.updated_at).getTime();
    const createdAt = new Date(user.organizations.created_at).getTime();
    
    // If updated_at is different from created_at, setup has been completed
    if (updatedAt !== createdAt) {
      // Mark as completed in session storage to avoid checking again
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('organizationSetupCompleted', 'true');
      }
      return false;
    }
  }

  return true;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mfaSetupStatus, setMfaSetupStatus] = useState<'unknown' | 'success' | 'failed' | 'missing_service_principal'>('unknown')
  const [isSessionExpired, setIsSessionExpired] = useState(false)
  const { toast } = useToast()

  // Calculate if user needs organization setup
  const needsOrganizationSetup = checkNeedsOrganizationSetup(user);

  // Function to process user from token
  const processUserFromToken = useCallback(async (idToken: string, accessToken?: string) => {
    try {
      const decodedToken = jwtDecode<any>(idToken);

      const userInfo = {
        email: decodedToken.preferred_username || decodedToken.email || "",
        name: decodedToken.name || "",
        tenantId: decodedToken.tid || "",
        objectId: decodedToken.oid || decodedToken.sub || "",
        clientId: decodedToken.aud || "",
        token: idToken,
        tokenExpiresAt: decodedToken.exp ? new Date(decodedToken.exp * 1000) : null,
        accessToken: accessToken
      };

      if (!userInfo.email) {
        throw new Error("No email found in token");
      }

      // Store tokens in session storage
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('idToken', idToken);
        if (accessToken) {
          window.sessionStorage.setItem('accessToken', accessToken);
        }
      }

      // Call the edge function to handle user creation/verification
      const apiResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/manage-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            userInfo: {
              ...userInfo,
              accessToken: accessToken // Pass the access token for MFA secret generation
            }
          }),
        }
      );

      if (!apiResponse.ok) {
        const error = await apiResponse.json();
        throw new Error(error.message || "Failed to process user");
      }

      const result = await apiResponse.json();
      
      // Store user info in sessionStorage for app use
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('currentUser', JSON.stringify(result.user));
        window.sessionStorage.setItem('userProcessed', 'true');
        // Store MFA setup status
        if (result.mfaSetupStatus) {
          window.sessionStorage.setItem('mfaSetupStatus', result.mfaSetupStatus);
        }
      }

      // Update MFA setup status in state
      if (result.mfaSetupStatus) {
        setMfaSetupStatus(result.mfaSetupStatus);
      }

      return result.user;
    } catch (error) {
      console.error("Error processing user from token:", error);
      throw error;
    }
  }, []);

  // Function to fetch user from session storage
  const fetchUser = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      const idToken = window.sessionStorage.getItem('idToken');
      const currentUser = window.sessionStorage.getItem('currentUser');
      const storedMfaStatus = window.sessionStorage.getItem('mfaSetupStatus');
      
      if (!idToken || !currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Parse stored user
      const parsedUser = JSON.parse(currentUser);
      setUser(parsedUser);
      
      // Load MFA setup status
      if (storedMfaStatus) {
        setMfaSetupStatus(storedMfaStatus as 'unknown' | 'success' | 'failed' | 'missing_service_principal');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Add token validation effect to periodically check for expired tokens
  useEffect(() => {
    if (!user) {
      return;
    }

    // Validate tokens immediately
    const validateTokens = async () => {
      try {
        const isValid = await tokenInterceptor.validateAuthenticationState();
        
        if (!isValid) {
          // Clear user state and show session expired modal
          setUser(null);
          setIsSessionExpired(true);
        }
      } catch (error) {
        console.error('Error validating tokens:', error);
        
        // Clear user state and show session expired modal for errors too
        setUser(null);
        setIsSessionExpired(true);
      }
    };

    validateTokens();

    // Set up periodic token validation (every 15 minutes)
    const validationInterval = setInterval(validateTokens, 15 * 60 * 1000);

    return () => {
      clearInterval(validationInterval);
    };
  }, [user]);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const idToken = window.sessionStorage.getItem('idToken');
      const accessToken = window.sessionStorage.getItem('accessToken');
      if (idToken) {
        // This function will fetch from the DB and update session storage
        const refreshedUser = await processUserFromToken(idToken, accessToken || undefined);
        setUser(refreshedUser);
      } else {
        // If no token, clear user
        setUser(null);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
      // Optionally, handle the error, e.g., by logging out the user
    } finally {
      setIsLoading(false);
    }
  }, [processUserFromToken]);

  const markOrganizationSetupCompleted = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('organizationSetupCompleted', 'true');
    }
  }, []);

  const handleLoginRedirect = useCallback(async (instance: IPublicClientApplication) => {
    setIsLoading(true);
    try {
      // Clear any existing session data
      if (typeof window !== 'undefined') {
        window.sessionStorage.clear();
      }
      
      // Use the login request from config
      await instance.loginRedirect(loginRequest);
    } catch (error: any) {
      console.error('Error logging in:', error);
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(async (instance: IPublicClientApplication) => {
    try {
      // Clear session storage
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('idToken');
        window.sessionStorage.removeItem('accessToken');
        window.sessionStorage.removeItem('currentUser');
        window.sessionStorage.removeItem('userProcessed');
        window.sessionStorage.removeItem('mfaSecretChecked');
        window.sessionStorage.removeItem('mfaSetupStatus');
        window.sessionStorage.removeItem('organizationSetupCompleted');
        window.sessionStorage.removeItem('msalInitialized'); // Clear MSAL initialization status
      }
      
      setUser(null);
      setMfaSetupStatus('unknown');
      
      // Clear active account
      instance.setActiveAccount(null);
      
      // Logout from MSAL
      await instance.logoutRedirect({
        postLogoutRedirectUri: "https://authenpush.com",
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  const handleSessionExpiredLogin = useCallback(() => {
    setIsSessionExpired(false);
    
    // Clear only authentication-related session data (not all sessionStorage)
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('idToken');
      window.sessionStorage.removeItem('accessToken');
      window.sessionStorage.removeItem('currentUser');
      window.sessionStorage.removeItem('userProcessed');
      window.sessionStorage.removeItem('mfaSecretChecked');
      window.sessionStorage.removeItem('mfaSetupStatus');
      window.sessionStorage.removeItem('organizationSetupCompleted');
    }
    
    // Small delay to let React finish state updates before navigating
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }, 500);
  }, []);



  return (
    <>
      <AuthContext.Provider
        value={{
          refreshUser,
          user,
          isLoading,
          isAuthenticated: !!user,
          needsOrganizationSetup,
          mfaSetupStatus,
          isSessionExpired,
          updateUser,
          markOrganizationSetupCompleted,
          handleLoginRedirect,
          handleLogout,
          processUserFromToken,
          handleSessionExpiredLogin,
        }}
      >
        {children}
      </AuthContext.Provider>
      
      <SessionExpiredModal 
        isOpen={isSessionExpired}
        onLoginAgain={handleSessionExpiredLogin}
      />
    </>
  )
}

// Custom hook to use the context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 