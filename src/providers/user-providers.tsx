'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '../userAuthConfig';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import Loader from "@/components/common/Loader";

const queryClient = new QueryClient()
// Initialize the MSAL application object
const msalInstance = new PublicClientApplication(msalConfig);

export function Providers({ children }: { children: React.ReactNode }) {

  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeMsal = async () => {
      try {
        // Check if already initialized to avoid re-initialization
        if (msalInstance.getConfiguration()) {
          setIsInitialized(true);
          return;
        }

        await msalInstance.initialize()
        
        // Add event callback to handle login success
        msalInstance.addEventCallback((event) => {
          console.log('MSAL Event:', event);
          
          if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
            console.log('Login success event:', event.payload);
            // Store the auth result for the auth callback to use
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem('msalAuthResult', JSON.stringify(event.payload));
            }
          }
          
          if (event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS && event.payload) {
            console.log('Token acquisition success:', event.payload);
          }
        });
        
        setIsInitialized(true)
      } catch (error) {
        setError('Failed to initialize MSAL')
        console.error('MSAL initialization error:', error)
      }
    }

    initializeMsal()
  }, [])

  if (error) {
    return <div>{error}</div>
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
        <Toaster />
        <Sonner />
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <MsalProvider instance={msalInstance}>
          <AuthProvider>
            <Toaster />
            {children}
          </AuthProvider>
        </MsalProvider>
      </ThemeProvider>
      </TooltipProvider>

    </QueryClientProvider>
  )
} 

export default Providers