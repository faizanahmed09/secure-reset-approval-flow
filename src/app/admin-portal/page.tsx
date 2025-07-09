'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link'
import { FileText, LogOut, Loader2, Users, ArrowRight, Shield, Settings, Send, Building2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useAuth } from '@/contexts/AuthContext';
import { BeautifulLoader } from '@/app/loader';
import { useRouter } from 'next/navigation';
import { AdminPortalDashboardSkeleton } from '@/components/PageSkeletons';

const Index = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { user, isLoading, isAuthenticated, needsOrganizationSetup, mfaSetupStatus, handleLogout, isSessionExpired } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

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

  // Handle redirect for unauthenticated users (but not when session expired modal is showing)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isSessionExpired) {
      window.location.href = '/';
    }
  }, [isLoading, isAuthenticated, isSessionExpired]);

  // Check for organization setup need and redirect if necessary
  useEffect(() => {
    if (!isLoading && isAuthenticated && needsOrganizationSetup) {
      router.push('/organization-setup');
      return;
    }
  }, [isLoading, isAuthenticated, needsOrganizationSetup, router]);

  // Check MFA setup status and update session storage accordingly
  useEffect(() => {
    console.log('Admin portal - MFA status check:', { 
      isLoading, 
      isAuthenticated, 
      needsOrganizationSetup, 
      mfaSetupStatus 
    });
    
    if (
      !isLoading && 
      isAuthenticated &&
      !needsOrganizationSetup &&
      mfaSetupStatus !== 'unknown'
    ) {
      // Only mark as checked if MFA setup was successful
      if (mfaSetupStatus === 'success') {
        console.log('MFA setup successful, marking as checked');
        setMfaCheckedStatus(true);
      } else {
        console.log('MFA setup failed or missing service principal, not marking as checked:', mfaSetupStatus);
        // If MFA setup failed or service principal is missing, don't mark as checked
        setMfaCheckedStatus(false);
      }
    }
  }, [isLoading, isAuthenticated, needsOrganizationSetup, mfaSetupStatus]);

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
  const isMfaCheckComplete = getMfaCheckedStatus();

  // Show initial loader while MSAL is initializing or content is not ready
  if (isInitializing || inProgress === 'startup' || inProgress === 'handleRedirect' || isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Header />
        <main className="flex-1 container py-12 flex items-center justify-center">
          <AdminPortalDashboardSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  // Show loader while redirecting to index page if not authenticated (but not when session expired modal is showing)
  if (!isAuthenticated && !isSessionExpired) {
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
    const userRole = user?.role;
    
    return (
      <div className="flex flex-col gap-4 w-full">
        {/* Admin can see all options, Verifier can see Start Verify User Process */}
        {(userRole === 'admin' || userRole === 'verifier') && (
          <Link href="/admin-portal/reset-approval" className="w-full">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              <Send className="mr-2 h-4 w-4" />
              Verify User
            </Button>
          </Link>
        )}
        
        {/* All authenticated users can see Manage Azure Users */}
        <Link href="/admin-portal/users" className="w-full">
          <Button variant="outline" className="w-full">
            <Users className="mr-2 h-4 w-4" />
            All Users
          </Button>
        </Link>
        
        {/* All authenticated users can see View Verify User Request Logs */}
        <Link href="/admin-portal/change-requests-log" className="w-full">
          <Button variant="outline" className="w-full flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            Verification Log
          </Button>
        </Link>
        
        {/* only Admin and verifier can see Manage Organization Users */}
        {(userRole === 'admin') && (
          <Link href="/admin-portal/application-users" className="w-full">
            <Button variant="outline" className="w-full">
              <Settings className="mr-2 h-4 w-4" />
              Admin Settings
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
            Sign Out
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-1 container py-12 flex items-center justify-center">
        <div className="relative max-w-md w-full min-h-[60vh] rounded-2xl flex items-center justify-center">
          <div className="relative z-10 w-full backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl p-8 flex flex-col items-center space-y-8">
            <img src="/logo.png" alt="Authenpush Logo" className="h-24 w-24" />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Verify User Identities</h2>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Building2 size={16} />
                <span>{user?.organizations?.display_name}</span>
              </div>
            </div>
            
            {/* MFA Service Principal Missing Alert */}
            {mfaSetupStatus === 'missing_service_principal' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-red-800 mb-1">MFA Service Setup Required</h3>
                    <p className="text-sm text-red-700 mb-2">
                      The AuthenPush MFA application service principal is not found in your Azure AD tenant. 
                      This is required for user verification to work.
                    </p>
                    <p className="text-xs text-red-600">
                      Please contact your Azure AD administrator to install the AuthenPush enterprise application in your tenant.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* MFA Setup Failed Alert */}
            {mfaSetupStatus === 'failed' && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-orange-800 mb-1">MFA Setup Error</h3>
                    <p className="text-sm text-orange-700 mb-2">
                      There was an error setting up MFA for your organization. User verification may not work properly.
                    </p>
                    <p className="text-xs text-orange-600">
                      Please try logging out and back in, or contact support if the issue persists.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
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