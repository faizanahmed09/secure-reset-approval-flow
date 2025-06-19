'use client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetApprovalForm from '@/components/ResetApprovalForm';
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
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
              <ResetApprovalForm />
          </div>
        </div>
        {/* button to show to top left corner of page */}
        <div className="fixed top-20 left-4 z-10">
          <Button
            variant="outline"
            className="mb-4"
            onClick={() => router.push("/admin-portal")}
            >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </div> 
      </main>
      <Footer />
    </div>
  );
};

export default ResetApproval;
