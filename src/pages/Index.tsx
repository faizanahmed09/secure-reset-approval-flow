
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AzureAuthForm from '@/components/AzureAuthForm';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">Password Reset Flow</h2>
              <p className="text-muted-foreground">
                Secure multi-factor password reset approval system
              </p>
            </div>
            
            <UnauthenticatedTemplate>
              <AzureAuthForm />
            </UnauthenticatedTemplate>
            
            <AuthenticatedTemplate>
              <div className="flex flex-col gap-4">
                <Link to="/reset-approval" className="w-full">
                  <Button className="w-full">Start Password Reset Process</Button>
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
              </div>
            </AuthenticatedTemplate>
            
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">About this system:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Authenticate using Azure AD credentials</li>
                <li>• View users in your Azure Active Directory</li>
                <li>• Initiate secure password reset requests</li>
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
