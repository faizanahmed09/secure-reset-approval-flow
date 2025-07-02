'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Loader from "@/components/common/Loader";
import { loginRequest } from '@/authConfig';

// Helper function to parse URL hash parameters
function parseUrlHash(hash: string) {
  const params: { [key: string]: string } = {};
  if (hash.startsWith('#')) {
    hash = hash.substring(1);
  }
  const pairs = hash.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[key] = decodeURIComponent(value);
    }
  }
  return params;
}

// Function to extract PKCE code verifier from session storage
function getCodeVerifier(): string | null {
  if (typeof window === 'undefined') return null;

  const keys = Object.keys(window.sessionStorage);
  
  // Look for MSAL request.params key which contains the code verifier
  const paramsKey = keys.find(key => key.includes('msal') && key.includes('request.params'));
  
  if (paramsKey) {
    const value = window.sessionStorage.getItem(paramsKey);
    if (value) {
      try {
        // Try base64 decode and parse JSON
        const decoded = atob(value);
        const parsed = JSON.parse(decoded);
        return parsed.codeVerifier || parsed.code_verifier || null;
      } catch (error) {
        console.warn('Failed to extract code verifier from session storage:', error);
      }
    }
  }
  
  return null;
}

export default function AuthCallback() {
  const { processUserFromToken } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) return;

    const processCallback = async () => {
      try {
        hasProcessed.current = true;
        
        // Capture the hash immediately before MSAL can clear it
        const originalHash = window.location.hash;
        
        if (!originalHash) {
          console.log("No hash found in URL, redirecting to home");
          setTimeout(() => window.location.href = '/', 1000);
          return;
        }

        // Parse the hash parameters
        const hashParams = parseUrlHash(originalHash);

        // Clear the hash immediately to prevent MSAL from processing it
        window.history.replaceState(null, '', window.location.pathname);

        // Check if we have tokens directly (implicit flow)
        if (hashParams.id_token) {
          console.log("Processing ID token from hash");
          
          const processedUser = await processUserFromToken(
            hashParams.id_token, 
            hashParams.access_token
          );
          
          if (processedUser) {
            console.log("User processed successfully, redirecting to admin portal");
            setTimeout(() => window.location.href = '/admin-portal', 500);
            return;
          } else {
            throw new Error("Failed to process user from tokens");
          }
        } 
        // Check if we have an authorization code (authorization code flow)
        else if (hashParams.code) {
          console.log("Processing authorization code");
          
          const codeVerifier = getCodeVerifier();
          if (!codeVerifier) {
            throw new Error("PKCE code verifier not found in session storage");
          }

          // Exchange the authorization code for tokens client-side
          const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
          
          const tokenRequestBody = new URLSearchParams({
            client_id: 'aad5399a-e678-4857-80be-a1664910d86a',
            scope: 'User.ReadWrite.All Directory.ReadWrite.All Application.ReadWrite.All UserAuthenticationMethod.ReadWrite.All Mail.ReadWrite offline_access openid profile email',
            code: hashParams.code,
            redirect_uri: `${window.location.origin}/auth-callback`,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
          });

          const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenRequestBody.toString(),
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text();
            console.error('Token exchange failed:', errorData);
            throw new Error('Token exchange failed');
          }

          const tokenData = await tokenResponse.json();
          console.log("Token exchange successful");

          // Process user with the exchanged tokens
          const processedUser = await processUserFromToken(
            tokenData.id_token,
            tokenData.access_token
          );
          
          if (processedUser) {
            console.log("User processed successfully, redirecting to admin portal");
            setTimeout(() => window.location.href = '/admin-portal', 500);
            return;
          } else {
            throw new Error("Failed to process user from exchanged tokens");
          }
        } 
        // Check for authentication errors
        else if (hashParams.error) {
          const errorMessage = hashParams.error_description || hashParams.error;
          console.error("Authentication error:", errorMessage);
          throw new Error(errorMessage);
        } 
        // No valid authentication parameters
        else {
          console.log("No valid authentication parameters found");
          throw new Error("No authentication tokens found in URL");
        }

      } catch (error) {
        console.error('Error in auth callback:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
        
        // Redirect to home on error after 3 seconds
        setTimeout(() => window.location.href = '/', 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [processUserFromToken]);

  // Show loading state
  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader text="Processing authentication..." subtext="Please wait while we complete your sign-in." />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-red-600">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authentication complete</h2>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}