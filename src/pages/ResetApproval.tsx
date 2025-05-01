
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetApprovalForm from '@/components/ResetApprovalForm';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const ResetApproval = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Password Reset Approval</h2>
              <p className="text-muted-foreground">
                Request and monitor password reset approvals
              </p>
            </div>
            
            <AuthenticatedTemplate>
              <ResetApprovalForm />
            </AuthenticatedTemplate>
            
            <UnauthenticatedTemplate>
              <div className="bg-muted/50 p-6 rounded-md border text-center">
                <h3 className="font-medium mb-2">Authentication Required</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You need to authenticate with Azure AD before accessing this page.
                </p>
                <Button onClick={() => navigate('/')}>
                  Go to Login
                </Button>
              </div>
            </UnauthenticatedTemplate>
            
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">Process Information:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enter the user's email address</li>
                <li>• System sends a secure push notification to the user</li>
                <li>• User approves or rejects the request</li>
                <li>• On approval, the password is reset automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ResetApproval;
