'use client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetApprovalForm from '@/components/ResetApprovalForm';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BeautifulLoader } from '@/app/loader';

const ResetApproval = () => {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Redirect to admin portal if not authenticated
  if (!isAuthenticated) {
    router.push('/admin-portal');
    return null;
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
