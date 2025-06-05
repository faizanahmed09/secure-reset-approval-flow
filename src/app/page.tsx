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
import { handleUserOnRedirect, getCurrentUser, isUserProcessed, clearUserSession } from '../services/userService';
import { MfaConfigLoader, BeautifulLoader } from '@/app/loader';

interface user{
  email: string;
  name: string;
  tenantId: string;
  objectId: string;
  display_name: string;
}

const Index = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { toast } = useToast();
  const [checkingMfa, setCheckingMfa] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [processingUser, setProcessingUser] = useState(false);
  const [currentUser, setCurrentUser] = useState<user | null>(null);
  
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

  // Updated useEffect for processing user from URL redirect
  useEffect(() => {
    const processUserFromUrl = async () => {
      if (typeof window === 'undefined') return;
      
      // Check if we have an id_token in URL and haven't processed user yet
      const hash = window.location.hash;
      const hasIdToken = hash.includes('id_token=');
      const userAlreadyProcessed = isUserProcessed();
      
      console.log('Processing check:', { hasIdToken, userAlreadyProcessed });
      
      if (hasIdToken && !userAlreadyProcessed) {
        setProcessingUser(true);
        try {
          console.log("Processing user from URL redirect...");
          const result = await handleUserOnRedirect();
          
          if (result) {
            setCurrentUser(result.user);
            toast({
              title: result.action === 'signup' ? "Welcome!" : "Welcome Back!",
              description: result.action === 'signup' 
                ? "Your account has been created successfully." 
                : "You've been logged in successfully.",
            });
          }
        } catch (error) {
          console.error("Error processing user:", error);
          toast({
            title: "User Processing Error",
            description: "There was an issue setting up your account. Please try again.",
            variant: "destructive",
          });
        } finally {
          setProcessingUser(false);
        }
      } else if (userAlreadyProcessed) {
        // User already processed, just get from storage
        const user = getCurrentUser();
        if (user) {
          setCurrentUser(user);
        }
      }
    };

    processUserFromUrl();
  }, []); // Empty dependency array - runs once on mount

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

  // Original MFA check logic (unchanged but with added condition)
  useEffect(() => {
    const mfaAlreadyChecked = getMfaCheckedStatus();
    
    if (
      accounts.length > 0 && 
      inProgress === 'none' && 
      !checkingMfa && 
      !mfaAlreadyChecked &&
      !processingUser && // Wait for user processing to complete
      isUserProcessed() // Only check MFA after user is processed
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
  }, [accounts, inProgress, checkingMfa, instance, toast, processingUser]);

  const handleLogout = async () => {
    try {
      // Reset MFA check state on logout
      setMfaCheckedStatus(false);
      
      // Clear user session
      clearUserSession();
      setCurrentUser(null);
      
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
              {currentUser && (
                <p className="text-sm text-blue-600">
                  Welcome, {currentUser.display_name || currentUser.email}
                </p>
              )}
            </div>
            
            <UnauthenticatedTemplate>
              <AzureAuthForm />
            </UnauthenticatedTemplate>
            
            <AuthenticatedTemplate>
              {processingUser ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <h3 className="text-lg font-medium">Setting Up Your Account</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    We're preparing your account. This will only take a moment...
                  </p>
                </div>
              ) : checkingMfa ? (
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