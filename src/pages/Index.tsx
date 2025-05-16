import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AzureAuthForm from '@/components/AzureAuthForm';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { FileText, LogOut, Loader2 } from 'lucide-react';
import { clearAzureAuth } from '../authConfig';
import { useToast } from '@/hooks/use-toast';
import { checkMfaSecret } from '../services/mfaSecretService';

const Index = () => {
  const { instance, accounts, inProgress } = useMsal();
  const { toast } = useToast();
  const [checkingMfa, setCheckingMfa] = useState(false);
  
  // Check if MFA has already been checked in this session
  const getMfaCheckedStatus = () => {
    return sessionStorage.getItem('mfaSecretChecked') === 'true';
  };
  
  // Set MFA checked status in session storage
  const setMfaCheckedStatus = (checked: boolean) => {
    sessionStorage.setItem('mfaSecretChecked', checked.toString());
  };

  useEffect(() => {
    const mfaAlreadyChecked = getMfaCheckedStatus();
    
    if (
      accounts.length > 0 && 
      inProgress === 'none' && 
      !checkingMfa && 
      !mfaAlreadyChecked
    ) {
      const verifyMfaSecret = async () => {
        setCheckingMfa(true);
        try {
          // Get tokens silently
          const tokenResponse = await instance.acquireTokenSilent({
            scopes: ['https://graph.microsoft.com/Application.ReadWrite.All'],
            account: accounts[0]
          });

          console.log("Checking MFA secret configuration...");
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
  }, [accounts, inProgress, checkingMfa, instance, toast]);

  const handleLogout = async () => {
    try {
      // Reset MFA check state on logout
      setMfaCheckedStatus(false);
      
      // Log out from MSAL
      instance.logoutRedirect().catch(console.error);

      // Clear Azure auth-related items
      clearAzureAuth();

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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex flex-col items-center">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Change Request Approval System</h2>
              <p className="text-muted-foreground">
                Secure change request approval system
              </p>
            </div>
            
            <UnauthenticatedTemplate>
              <AzureAuthForm />
            </UnauthenticatedTemplate>
            
            <AuthenticatedTemplate>
              {checkingMfa ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <h3 className="text-lg font-medium">Configuring Secure Access</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    We're setting up secure access for your account. This may take a few moments...
                  </p>
                </div>
              ) : (
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
              )}
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