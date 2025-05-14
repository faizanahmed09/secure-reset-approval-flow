
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AzureAuthForm from '@/components/AzureAuthForm';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { FileText, LogOut } from 'lucide-react';
import { clearAzureAuth } from '../authConfig';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { instance } = useMsal();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      // Log out from MSAL
      instance.logoutRedirect().catch(console.error);

      // Clear Azure auth-related items from localStorage/sessionStorage
      clearAzureAuth();

      toast({
        title: "Logged Out Successfully",
        description: "You've been logged out from Azure AD",
      });

      window.location.href = "/";
    } catch (error: any) {
      console.error("Error during logout:", error);
      toast({
        title: "Logout Error",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Change Request Approval System</h2>
              <p className="text-muted-foreground">
                Secure change request approval approval system
              </p>
            </div>
            
            <UnauthenticatedTemplate>
              <AzureAuthForm />
            </UnauthenticatedTemplate>
            
            <AuthenticatedTemplate>
              <div className="flex flex-col gap-4">
                <Link to="/reset-approval" className="w-full">
                  <Button className="w-full">Start Change Request Process</Button>
                </Link>
                <Link to="/users" className="w-full">
                  <Button variant="outline" className="w-full">Manage Users</Button>
                </Link>
                <Link to="/change-requests-log" className="w-full">
                  <Button variant="outline" className="w-full flex items-center">
                    <FileText className="mr-2 h-4 w-4" />
                    View Change Request Logs
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
            </AuthenticatedTemplate>
            
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">About this system:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Authenticate using Azure AD credentials</li>
                <li>• View users in your Azure Active Directory</li>
                <li>• Initiate secure change requests</li>
                <li>• Requires user approval via push notification</li>
                <li>• Track change request history in logs</li>
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
