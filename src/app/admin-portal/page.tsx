'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link'
import { FileText, LogOut, Loader2, Users, ArrowRight, Shield, Settings, Send, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useAuth } from '@/contexts/AuthContext';
import { BeautifulLoader } from '@/app/loader';
import { useRouter } from 'next/navigation';

const Index = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { user, isLoading, isAuthenticated, needsOrganizationSetup, handleLogout } = useAuth();
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

  // MFA is now handled during login, so we just mark it as checked
  useEffect(() => {
    const mfaAlreadyChecked = getMfaCheckedStatus();
    
    // Since MFA secrets are now managed during login, we don't need to do anything here
    // Just mark as checked to prevent loading states
    if (
      !mfaAlreadyChecked &&
      !isLoading && 
      isAuthenticated &&
      !needsOrganizationSetup
    ) {
      setMfaCheckedStatus(true);
    }
  }, [isLoading, isAuthenticated, needsOrganizationSetup]);

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
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8 flex flex-col items-center">
            <img src="/logo.png" alt="Authenpush Logo" className="h-24 w-24" />
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Verify User Identities</h2>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Building2 size={16} />
                    <span>{user?.organizations?.display_name}</span>
                </div>
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