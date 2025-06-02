'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AzureAuthForm from '@/components/AzureAuthForm';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link'
import { FileText, LogOut, Loader2, Users, ArrowRight, Shield } from 'lucide-react';
import { clearAzureAuth } from '../authConfig';
import { useToast } from '@/hooks/use-toast';
import { checkMfaSecret } from '../services/mfaSecretService';
import { MfaConfigLoader, BeautifulLoader } from '@/loader';

const Index = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { toast } = useToast();
  const [checkingMfa, setCheckingMfa] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Check if MFA has already been checked in this session
  const getMfaCheckedStatus = () => {
    if (typeof window !== 'undefined') {
      return window.sessionStorage.getItem('mfaSecretChecked') === 'true';
    }
  };
  
  // Set MFA checked status in session storage
  const setMfaCheckedStatus = (checked: boolean) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('mfaSecretChecked', String(checked));
    }
  };

  // Handle initial loading state
  useEffect(() => {
    // Wait for MSAL to finish initializing
    if (inProgress === 'none') {
      // Add a small delay to prevent flash
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [inProgress]);

  useEffect(() => {
    const mfaAlreadyChecked = getMfaCheckedStatus();
    
    if (
      accounts.length > 0 && 
      inProgress === 'none' && 
      !checkingMfa && 
      !mfaAlreadyChecked
    ) {
      const verifyMfaSecret = async () => {
        setCheckingMfa(true);
        try {
          // Get tokens silently
          const tokenResponse = await instance.acquireTokenSilent({
            scopes: ['https://graph.microsoft.com/Application.ReadWrite.All'],
            account: accounts[0]
          });

          const secretResult = await checkMfaSecret(
            tokenResponse.accessToken,
            tokenResponse.idToken
          );

          // If a new secret was created, wait for propagation
          if (secretResult.newlyCreated) {
            // Wait for secret propagation
            await new Promise(resolve => setTimeout(resolve, 4000));
          }
          
          // Mark MFA as checked for this session
          setMfaCheckedStatus(true);
        } catch (error) {
          console.error("Error checking MFA secret:", error);
          toast({
            title: "Warning",
            description: "There was an issue configuring MFA. Some features may be limited.",
            variant: "destructive",
          });
          
          // Even on error, mark as checked to prevent repeated errors
          setMfaCheckedStatus(true);
        } finally {
          setCheckingMfa(false);
        }
      };

      verifyMfaSecret();
    }
  }, [accounts, inProgress, checkingMfa, instance, toast]);

  const handleLogout = async () => {
    try {
      // Reset MFA check state on logout
      setMfaCheckedStatus(false);
      
      // Log out from MSAL
      instance.logoutRedirect().catch(console.error);

      // Clear Azure auth-related items
      clearAzureAuth();

      toast({
        title: "Logged Out Successfully",
        description: "You've been logged out from Azure AD",
      });
    } catch (error: any) {
      console.error("Error during logout:", error);
      toast({
        title: "Logout Error",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
    }
  };

  // Check the current status from sessionStorage for rendering decisions
  const isMfaCheckComplete = !checkingMfa && getMfaCheckedStatus();


  // Show initial loader while MSAL is initializing or content is not ready
  if (isInitializing || inProgress === 'startup' || inProgress === 'handleRedirect') {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex flex-col items-center">
            <div className="max-w-md w-full">
              <BeautifulLoader />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">User Verification System</h2>
              <p className="text-muted-foreground">
                Secure user verification system
              </p>
            </div>
            
            <UnauthenticatedTemplate>
              <AzureAuthForm />
            </UnauthenticatedTemplate>
            
            <AuthenticatedTemplate>
              {checkingMfa ? (
                <MfaConfigLoader />
              ) : (
                <div className="flex flex-col gap-4">
                  <Link href="/reset-approval" className="w-full">
                    <Button className="w-full">
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Start Verify User Process
                    </Button>
                  </Link>
                  <Link href="/users" className="w-full">
                    <Button variant="outline" className="w-full">
                    <Users className="mr-2 h-4 w-4" />
                      Manage Users
                    </Button>
                  </Link>
                  <Link href="/change-requests-log" className="w-full">
                    <Button variant="outline" className="w-full flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      View Verify User Request Logs
                    </Button>
                  </Link>
                  <div className="flex justify-center items-center gap-2">
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleLogout} 
                      className="w-full"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </div>
              )}
            </AuthenticatedTemplate>
            
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">About this system:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Authenticate using Azure AD credentials</li>
                <li>• View users in your Azure Active Directory</li>
                <li>• Initiate secure verify user process</li>
                <li>• Requires user approval via push notification</li>
                <li>• Track verify user request history in logs</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;