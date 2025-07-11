
'use client';
import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Lock, Key, Building, Loader2, Settings } from 'lucide-react';
import { loginRequest, clearAzureAuth } from '../userAuthConfig';
import AzureConfigForm from './AzureConfigForm';

const AzureAuthForm = () => {
  const { instance } = useMsal();
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check if Azure credentials are configured
    const clientId = localStorage.getItem('azureClientId');
    const tenantId = localStorage.getItem('azureTenantId');

    if (!clientId || !tenantId) {
      setHasCredentials(false);
      setShowConfig(true);
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);

    try {
      // Try to login with a popup
      const loginResponse = await instance.loginPopup(loginRequest);

      // Store token in session storage
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('azureToken', loginResponse.accessToken);
        window.sessionStorage.setItem('azureTokenExpiry', (Date.now() + 3600 * 1000).toString());
      }

      toast({
        title: "Authentication Successful",
        description: "You've been authenticated with Azure AD",
      });

      // Redirect to reset approval page
      // redirect('/');
      // navigate('/admin-portal/users');

    } catch (error: any) {
      console.error('Error during Azure AD authentication:', error);

      toast({
        title: "Authentication Error",
        description: error.message || 'An unexpected error occurred',
        variant: "destructive",
      });

      // If popup fails, try redirect
      if (error.name === "PopupBlockedError") {
        try {
          await instance.loginRedirect(loginRequest);
        } catch (redirectError) {
          console.error('Redirect login failed:', redirectError);
        }
      }
    } finally {
      setLoading(false);
    }
  };


  const handleConfigComplete = () => {
    setHasCredentials(true);
    setShowConfig(false);
    // Force page reload to apply new credentials
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (showConfig) {
    return <AzureConfigForm onConfigComplete={handleConfigComplete} />;
  }

  return (
    <Card className="w-full max-w-md security-card">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Azure AD Authentication</CardTitle>
        <CardDescription className="text-center">
          Authenticate with your Azure AD account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 p-4 rounded-md border">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Key className="h-4 w-4" /> Authentication Information:
          </h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• You'll be redirected to Microsoft login</li>
            <li>• Login with your Azure AD credentials</li>
            <li>• Your credentials are never stored locally</li>
            <li>• Secure using Microsoft identity platform</li>
          </ul>
        </div>

        <Button
          onClick={handleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={loading || !hasCredentials}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            'Connect with Microsoft'
          )}
        </Button>


        <Button
          onClick={() => setShowConfig(true)}
          variant="outline"
          className="w-full"
        >
          <Settings className="mr-2 h-4 w-4" /> Configure Azure Credentials
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        Secure authentication powered by Microsoft Identity
      </CardFooter>
    </Card>
  );
};

export default AzureAuthForm;
