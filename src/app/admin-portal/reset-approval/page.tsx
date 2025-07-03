'use client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetApprovalForm from '@/components/ResetApprovalForm';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BeautifulLoader } from '@/app/loader';
import { useEffect } from 'react';

const ResetApproval = () => {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, mfaSetupStatus, isSessionExpired } = useAuth();

  // Handle redirect for unauthenticated users (but not when session expired modal is showing)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isSessionExpired) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, isSessionExpired, router]);

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Show loader while redirecting to login if not authenticated (but not when session expired modal is showing)
  if (!isAuthenticated && !isSessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  return (
    <SubscriptionGuard feature="MFA reset approval">
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container py-12">
          <div className="max-w-7xl mx-auto">
            <Button
              variant="outline"
              className="mb-6"
              onClick={() => router.push("/admin-portal")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
            {/* MFA Service Principal Missing Alert */}
            {mfaSetupStatus === 'missing_service_principal' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-red-800 mb-1">MFA Service Setup Required</h3>
                    <p className="text-sm text-red-700 mb-2">
                      The AuthenPush MFA application service principal is not found in your Azure AD tenant. 
                      User verification cannot be performed without this setup.
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
            
            <div className="flex flex-col items-center">
              <div className="max-w-md w-full space-y-8">
                  <ResetApprovalForm />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </SubscriptionGuard>
  );
};

export default ResetApproval;
