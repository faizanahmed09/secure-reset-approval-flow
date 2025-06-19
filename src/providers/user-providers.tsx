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

// Flag to prevent double initialization in StrictMode
let msalInitialized = false;

export function Providers({ children }: { children: React.ReactNode }) {

  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let eventCallbackId: string | null = null;

    const initializeMsal = async () => {
      // Prevent double initialization in StrictMode
      if (msalInitialized) {
          setIsInitialized(true);
          return;
        }

      try {
        // Initialize MSAL instance
        await msalInstance.initialize()
        msalInitialized = true;
        
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
        
        setIsInitialized(true)
      } catch (error) {
        setError('Failed to initialize MSAL. Please refresh the page.')
        console.error('❌ MSAL initialization error:', error)
      }
    }

    initializeMsal()

    // Cleanup function to remove event callback
    return () => {
      if (eventCallbackId) {
        msalInstance.removeEventCallback(eventCallbackId);
      }
    }
  }, [])

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