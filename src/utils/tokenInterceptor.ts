import { IPublicClientApplication } from "@azure/msal-browser";
import { jwtDecode } from "jwt-decode";
import { loginRequest } from '@/userAuthConfig';

interface TokenInfo {
  accessToken: string;
  expiresAt: number;
  idToken?: string;
}

export class TokenInterceptor {
  private static instance: TokenInterceptor;
  private msalInstance: IPublicClientApplication | null = null;
  private accounts: any[] = [];

  private constructor() {}

  public static getInstance(): TokenInterceptor {
    if (!TokenInterceptor.instance) {
      TokenInterceptor.instance = new TokenInterceptor();
    }
    return TokenInterceptor.instance;
  }

  public initialize(msalInstance: IPublicClientApplication, accounts: any[]) {
    this.msalInstance = msalInstance;
    this.accounts = accounts;
  }

  /**
   * Check if a token is expired or will expire soon (within 5 minutes)
   */
  private isTokenExpired(token: string): boolean {
    try {
      const decoded: any = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const bufferTime = 5 * 60; // 5 minutes buffer
      return decoded.exp < (currentTime + bufferTime);
    } catch (error) {
      console.error('Error decoding token:', error);
      return true; // Consider invalid tokens as expired
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  public async getValidAccessToken(): Promise<string> {
    try {
      // Check if we have a stored token and if it's still valid
      const storedToken = typeof window !== 'undefined' ? 
        window.sessionStorage.getItem('accessToken') : null;

      if (storedToken && !this.isTokenExpired(storedToken)) {
        return storedToken;
      }

      // Token is expired or doesn't exist, try to refresh
      if (this.msalInstance && this.accounts.length > 0) {
        return await this.refreshAccessToken();
      }

      // No MSAL instance or accounts, redirect to login
      this.redirectToLogin('No valid authentication available');
      throw new Error('AUTHENTICATION_REQUIRED');
    } catch (error) {
      console.error('Error getting valid access token:', error);
      throw error;
    }
  }

  /**
   * Refresh the access token using MSAL silent token acquisition
   */
  private async refreshAccessToken(): Promise<string> {
    if (!this.msalInstance || this.accounts.length === 0) {
      throw new Error('No MSAL instance or accounts available');
    }

    try {
      // Ensure active account is set
      if (!this.msalInstance.getActiveAccount()) {
        this.msalInstance.setActiveAccount(this.accounts[0]);
      }

      const tokenResponse = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: this.accounts[0],
      });

      // Store the new token
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('accessToken', tokenResponse.accessToken);
        if (tokenResponse.idToken) {
          window.sessionStorage.setItem('idToken', tokenResponse.idToken);
        }
      }

      return tokenResponse.accessToken;
    } catch (error: any) {
      console.error('Silent token acquisition failed:', error);
      
      // Handle specific MSAL errors
      if (error.name === "InteractionRequiredAuthError" || 
          error.errorCode === "interaction_required" ||
          error.errorCode === "consent_required" ||
          error.errorCode === "login_required") {
        this.redirectToLogin('Interactive authentication required');
      }
      
      throw error;
    }
  }

  /**
   * Enhanced fetch wrapper that automatically handles token refresh and Graph API errors
   */
  public async graphApiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    try {
      const accessToken = await this.getValidAccessToken();
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized responses (token expired during request)
      if (response.status === 401) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if it's a token expiration error
        if (errorData.error?.code === 'InvalidAuthenticationToken' || 
            errorData.error?.message?.includes('token is expired')) {
          
          console.log('Token expired during request, attempting refresh...');
          
          // Clear the expired token
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('accessToken');
          }

          try {
            // Try to refresh the token once
            const newAccessToken = await this.refreshAccessToken();
            
            // Retry the request with the new token
            const retryResponse = await fetch(url, {
              ...options,
              headers: {
                ...headers,
                'Authorization': `Bearer ${newAccessToken}`,
              },
            });

            // If retry also fails with 401, redirect to login
            if (retryResponse.status === 401) {
              this.redirectToLogin('Authentication failed after token refresh');
              throw new Error('AUTHENTICATION_FAILED');
            }

            return retryResponse;
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            this.redirectToLogin('Unable to refresh authentication');
            throw new Error('AUTHENTICATION_FAILED');
          }
        }
      }

      return response;
    } catch (error) {
      console.error('Graph API fetch error:', error);
      throw error;
    }
  }

  /**
   * Check the current authentication state and validate tokens
   */
  public async validateAuthenticationState(): Promise<boolean> {
    try {
      const idToken = typeof window !== 'undefined' ? 
        window.sessionStorage.getItem('idToken') : null;
      const accessToken = typeof window !== 'undefined' ? 
        window.sessionStorage.getItem('accessToken') : null;

      // No tokens at all
      if (!idToken && !accessToken) {
        return false;
      }

      // Check if ID token is expired
      if (idToken && this.isTokenExpired(idToken)) {
        console.log('ID token is expired');
        this.clearStoredTokens();
        return false;
      }

      // Check if access token is expired and try to refresh
      if (accessToken && this.isTokenExpired(accessToken)) {
        console.log('Access token is expired, attempting refresh...');
        try {
          await this.refreshAccessToken();
          return true;
        } catch (error) {
          console.error('Failed to refresh access token:', error);
          this.clearStoredTokens();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating authentication state:', error);
      return false;
    }
  }

  /**
   * Clear all stored authentication tokens
   */
  private clearStoredTokens(): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('idToken');
      window.sessionStorage.removeItem('accessToken');
      window.sessionStorage.removeItem('currentUser');
      window.sessionStorage.removeItem('userProcessed');
      window.sessionStorage.removeItem('mfaSecretChecked');
      window.sessionStorage.removeItem('organizationSetupCompleted');
    }
  }

  /**
   * Redirect to login page with proper cleanup
   */
  private redirectToLogin(reason: string): void {
    console.log(`Redirecting to login: ${reason}`);
    
    this.clearStoredTokens();
    
    // Show a toast notification if available
    if (typeof window !== 'undefined' && (window as any).showToast) {
      (window as any).showToast({
        title: 'Session Expired',
        description: 'Your session has expired. Redirecting to login...',
        variant: 'destructive',
      });
    }

    // Redirect after a short delay to allow toast to show
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }, 1500);
  }

  /**
   * Handle Graph API errors globally
   */
  public handleGraphApiError(error: any, context?: string): void {
    console.error(`Graph API error${context ? ` in ${context}` : ''}:`, error);

    // Check for authentication-related errors
    if (error.message === 'AUTHENTICATION_REQUIRED' || 
        error.message === 'AUTHENTICATION_FAILED' ||
        (error.error && error.error.code === 'InvalidAuthenticationToken')) {
      this.redirectToLogin('Authentication error detected');
      return;
    }

    // Check for interaction required errors
    if (error.message === 'INTERACTION_REQUIRED') {
      this.redirectToLogin('Interactive authentication required');
      return;
    }

    // For other errors, log them but don't redirect
    console.error('Non-authentication Graph API error:', error);
  }
}

// Export a singleton instance
export const tokenInterceptor = TokenInterceptor.getInstance(); 