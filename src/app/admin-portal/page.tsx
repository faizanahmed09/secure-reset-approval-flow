'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link'
import { FileText, LogOut, Loader2, Users, ArrowRight, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { checkMfaSecret } from '../../services/mfaSecretService';
import { useAuth } from '@/contexts/AuthContext';
import { MfaConfigLoader, BeautifulLoader } from '@/app/loader';
import { OrganizationInfo } from '@/components/OrganizationInfo';
import { useRouter } from 'next/navigation';

const Index = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { user, isLoading, isAuthenticated, needsOrganizationSetup, handleLogout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
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
      setIsInitializing(false);
    }
  }, [inProgress]);

  // Handle redirect for unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  // Check for organization setup need and redirect if necessary
  useEffect(() => {
    if (!isLoading && isAuthenticated && needsOrganizationSetup) {
      router.push('/organization-setup');
      return;
    }
  }, [isLoading, isAuthenticated, needsOrganizationSetup, router]);

  // MFA check logic
  useEffect(() => {
    const mfaAlreadyChecked = getMfaCheckedStatus();
    
    if (
      accounts.length > 0 && 
      inProgress === 'none' && 
      !checkingMfa && 
      !mfaAlreadyChecked &&
      !isLoading && 
      isAuthenticated &&
      !needsOrganizationSetup // Only run MFA check if not redirecting to organization setup
    ) {
      const verifyMfaSecret = async () => {
        setCheckingMfa(true);
        try {
          // Ensure active account is set for MSAL
          if (!instance.getActiveAccount() && accounts.length > 0) {
            instance.setActiveAccount(accounts[0]);
          }
          
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
  }, [accounts, inProgress, checkingMfa, instance, toast, isLoading, isAuthenticated, needsOrganizationSetup]);

  const handleLogoutClick = async () => {
    try {
      // Reset MFA check state on logout
      setMfaCheckedStatus(false);
      
      // Use AuthContext logout
      await handleLogout(instance);

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
  if (isInitializing || inProgress === 'startup' || inProgress === 'handleRedirect' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Show loader while redirecting to index page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Show loader while redirecting to organization setup
  if (needsOrganizationSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Role-based button rendering
  const renderRoleBasedButtons = () => {
    if (checkingMfa) {
      return <MfaConfigLoader />;
    }

    const userRole = user?.role;
    
    return (
      <div className="flex flex-col gap-4">
        {/* Admin can see all options, Verifier can see Start Verify User Process */}
        {(userRole === 'admin' || userRole === 'verifier') && (
          <Link href="/admin-portal/reset-approval" className="w-full">
            <Button className="w-full">
              <ArrowRight className="mr-2 h-4 w-4" />
              Start Verify User Process
            </Button>
          </Link>
        )}
        
        {/* All authenticated users can see Manage Azure Users */}
        <Link href="/admin-portal/users" className="w-full">
          <Button variant="outline" className="w-full">
            <Users className="mr-2 h-4 w-4" />
            Manage Azure Users
          </Button>
        </Link>
        
        {/* All authenticated users can see View Verify User Request Logs */}
        <Link href="/admin-portal/change-requests-log" className="w-full">
          <Button variant="outline" className="w-full flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            View Verify User Request Logs
          </Button>
        </Link>
        
        {/* All authenticated users can see Manage Organization Users */}
        {user?.organizations && (
          <Link href="/application-users" className="w-full">
            <Button variant="outline" className="w-full">
              <Users className="mr-2 h-4 w-4" />
              Manage Organization Users
              {(userRole === 'verifier' || userRole === 'basic') && (
                <span className="ml-2 text-xs text-muted-foreground">(View Only)</span>
              )}
            </Button>
          </Link>
        )}
        
        {/* Logout button for all authenticated users */}
        <div className="flex justify-center items-center gap-2">
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleLogoutClick} 
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    );
  };

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
              {user && (
                <div className="space-y-2">
                  <p className="text-sm text-blue-600">
                    Welcome, {user.display_name || user.name || user.email}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full capitalize">
                      {user.role || 'user'}
                    </span>
                  </div>
                  {user.organizations && (
                    <OrganizationInfo 
                      organization={user.organizations} 
                      className="justify-center"
                    />
                  )}
                </div>
              )}
            </div>
            
            {/* Show role-based options for authenticated users */}
            {renderRoleBasedButtons()}
            
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;