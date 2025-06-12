'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from '../authConfig';
import { PublicClientApplication } from '@azure/msal-browser';
import { TooltipProvider } from "@/components/ui/tooltip";

const queryClient = new QueryClient()
// Initialize the MSAL application object
export function Providers({ children }: { children: React.ReactNode }) {
  const msalInstance = new PublicClientApplication(msalConfig);

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
        <Toaster />
        {children}
        </MsalProvider>
      </ThemeProvider>
      </TooltipProvider>

    </QueryClientProvider>
  )
} 

export default Providers