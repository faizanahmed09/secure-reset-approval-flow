
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetApprovalForm from '@/components/ResetApprovalForm';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ResetApproval = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <AuthenticatedTemplate>
              <ResetApprovalForm />
            </AuthenticatedTemplate>

            <UnauthenticatedTemplate>
              <div className="bg-muted/50 p-6 rounded-md border text-center">
                <h3 className="font-medium mb-2">Authentication Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You need to authenticate with Azure AD before accessing this
                  page.
                </p>
                <Button onClick={() => navigate("/")}>Go to Login</Button>
              </div>
            </UnauthenticatedTemplate>
          </div>
        </div>
        {/* button to show to top left corner of page */}
        <div className="fixed top-20 left-4 z-10">
          <Button
            variant="outline"
            className="mb-4"
            onClick={() => navigate("/")}
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
