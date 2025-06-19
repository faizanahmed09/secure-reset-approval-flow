'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '../userAuthConfig';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Loader from "@/components/common/Loader";

const queryClient = new QueryClient()
// Initialize the MSAL application object
const msalInstance = new PublicClientApplication(msalConfig);

// Check if MSAL was already initialized in this session
const getMsalInitializedStatus = () => {
  if (typeof window !== 'undefined') {
    return window.sessionStorage.getItem('msalInitialized') === 'true';
  }
  return false;
};

// Set MSAL initialized status in session storage
const setMsalInitializedStatus = (initialized: boolean) => {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('msalInitialized', String(initialized));
  }
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure we're on the client side before checking sessionStorage
  useEffect(() => {
    setIsClient(true);
    // Only check sessionStorage after we're on the client
    const alreadyInitialized = getMsalInitializedStatus();
    if (alreadyInitialized) {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    // Don't run if we're not on the client yet
    if (!isClient) return;

    let eventCallbackId: string | null = null;
    let isMounted = true;

    const initializeMsal = async () => {
      // Check if already initialized in this session
      const alreadyInitialized = getMsalInitializedStatus();
      
      if (alreadyInitialized) {
        console.log('🔄 MSAL already initialized in this session, skipping');
        if (isMounted) {
          setIsInitialized(true);
        }
        return;
      }

      try {
        console.log('🔄 Starting MSAL initialization');
        // Initialize MSAL instance
        await msalInstance.initialize()
        
        // Mark as initialized in session storage
        setMsalInitializedStatus(true);
        console.log('✅ MSAL initialization complete');
        
        // Add event callback for debugging and monitoring (only once)
        eventCallbackId = msalInstance.addEventCallback((event) => {
          // Only log important events to reduce noise
          if (event.eventType === EventType.LOGIN_SUCCESS) {
            console.log('✅ MSAL Login Success:', event.payload);
            // Set active account on successful login
            const authResult = event.payload as any;
            if (authResult.account) {
              msalInstance.setActiveAccount(authResult.account);
              console.log('✅ Active account set:', authResult.account.username);
            }
          }
          
          if (event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) {
            console.log('✅ MSAL Token Acquired Successfully');
          }
          
          if (event.eventType === EventType.LOGIN_FAILURE) {
            console.error('❌ MSAL Login Failure:', event.error);
          }
          
          if (event.eventType === EventType.ACQUIRE_TOKEN_FAILURE) {
            console.error('❌ MSAL Token Acquisition Failure:', event.error);
          }

          // Log redirect events with less detail
          if (event.eventType === EventType.HANDLE_REDIRECT_START) {
            console.log('🔄 MSAL Redirect Start');
          }
          
          if (event.eventType === EventType.HANDLE_REDIRECT_END) {
            console.log('🔄 MSAL Redirect End');
          }
        });
        
        // Set active account if accounts exist
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
          msalInstance.setActiveAccount(accounts[0]);
          console.log('✅ Active account set from existing accounts:', accounts[0].username);
        }
        
        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('❌ MSAL initialization error:', error);
        if (isMounted) {
          setError('Failed to initialize MSAL. Please refresh the page.');
        }
      }
    }

    initializeMsal()

    // Cleanup function to remove event callback
    return () => {
      isMounted = false;
      if (eventCallbackId) {
        msalInstance.removeEventCallback(eventCallbackId);
      }
    }
  }, [isClient])

  // Show nothing during SSR to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">Authentication Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  if (!isInitialized) {
    console.log('🔄 Showing MSAL initialization loader');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader text="Initializing authentication..." subtext="Please wait..." />
      </div>
    )
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <MsalProvider instance={msalInstance}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </MsalProvider>
          <Toaster />
          <Sonner />
      </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
} 

export default Providers