'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { IPublicClientApplication } from '@azure/msal-browser'
import { jwtDecode } from 'jwt-decode'
import { loginRequest } from '@/userAuthConfig'

const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co"

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
  name?: string;
  tenantId: string;
  objectId: string;
  display_name?: string;
  organization_id?: string;
  organizations?: Organization;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string;
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
  handleLoginRedirect: (instance: IPublicClientApplication) => Promise<void>
  handleLogout: (instance: IPublicClientApplication) => Promise<void>
  processUserFromToken: (idToken: string, accessToken?: string) => Promise<User | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Function to process user from token
  const processUserFromToken = useCallback(async (idToken: string, accessToken?: string) => {
    try {
      const decodedToken = jwtDecode<any>(idToken);
      console.log("Decoded token:", decodedToken);

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
          },
          body: JSON.stringify({
            userInfo
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
      
      if (!idToken || !currentUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Parse stored user
      const parsedUser = JSON.parse(currentUser);
      setUser(parsedUser);
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

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const handleLoginRedirect = useCallback(async (instance: IPublicClientApplication) => {
    setIsLoading(true);
    try {
      console.log("Starting login redirect...");
      
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
      }
      
      setUser(null);
      
      // Clear active account
      instance.setActiveAccount(null);
      
      // Logout from MSAL
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        refreshUser,
        user,
        isLoading,
        isAuthenticated: !!user,
        handleLoginRedirect,
        handleLogout,
        processUserFromToken,
      }}
    >
      {children}
    </AuthContext.Provider>
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