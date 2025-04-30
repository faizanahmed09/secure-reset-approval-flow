
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AzureADCredentials, AuthState } from '@/types/azure-types';
import { Lock, Key, Building, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const AzureAuthForm = () => {
  const [credentials, setCredentials] = useState<AzureADCredentials>({
    clientId: '',
    clientSecret: '',
    tenantId: '',
  });
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    error: undefined,
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check if user is authenticated
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login if not authenticated
        navigate('/login');
        return;
      }
      
      // Check if user already has Azure credentials
      const { data: azureCreds } = await supabase
        .from('azure_credentials')
        .select('*')
        .maybeSingle();
      
      if (azureCreds?.token) {
        // If credentials exist and token is valid, set as authenticated and redirect
        const now = new Date();
        const expiry = new Date(azureCreds.token_expires_at);
        
        if (expiry > now) {
          setAuthState({
            isAuthenticated: true,
            token: azureCreds.token,
          });
          toast({
            title: "Already Authenticated",
            description: "You're already authenticated with Azure AD",
          });
          navigate('/reset-approval');
        }
      }
    };
    
    checkUser();
  }, [navigate, toast]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // First ensure the user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to authenticate with Azure AD",
          variant: "destructive",
        });
        navigate('/login');
        return;
      }
      
      // Call the Azure Auth edge function
      const { data, error } = await supabase.functions.invoke('azure-auth', {
        body: credentials,
      });
      
      if (error || !data) {
        console.error('Azure AD authentication error:', error);
        setAuthState({
          isAuthenticated: false,
          error: error?.message || 'Failed to authenticate with Azure AD',
        });
        toast({
          title: "Authentication Failed",
          description: error?.message || 'Failed to authenticate with Azure AD',
          variant: "destructive",
        });
      } else {
        console.log('Azure AD authentication successful:', data);
        setAuthState({
          isAuthenticated: true,
          token: data.token,
        });
        toast({
          title: "Authentication Successful",
          description: "You've been authenticated with Azure AD",
        });
        navigate('/reset-approval');
      }
    } catch (error) {
      console.error('Error during Azure AD authentication:', error);
      setAuthState({
        isAuthenticated: false,
        error: error.message,
      });
      toast({
        title: "Authentication Error",
        description: error.message || 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md security-card">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Azure AD Authentication</CardTitle>
        <CardDescription className="text-center">
          Enter your Azure AD credentials to authenticate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId" className="flex items-center gap-2">
              <Key className="h-4 w-4" /> Client ID
            </Label>
            <Input 
              id="clientId"
              name="clientId"
              placeholder="Enter your Azure AD Client ID"
              value={credentials.clientId}
              onChange={handleInputChange}
              required
              className="border-azure/20 focus:border-azure"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientSecret" className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Client Secret
            </Label>
            <Input 
              id="clientSecret"
              name="clientSecret"
              type="password"
              placeholder="Enter your Azure AD Client Secret"
              value={credentials.clientSecret}
              onChange={handleInputChange}
              required
              className="border-azure/20 focus:border-azure"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tenantId" className="flex items-center gap-2">
              <Building className="h-4 w-4" /> Tenant ID
            </Label>
            <Input 
              id="tenantId"
              name="tenantId"
              placeholder="Enter your Azure AD Tenant ID"
              value={credentials.tenantId}
              onChange={handleInputChange}
              required
              className="border-azure/20 focus:border-azure"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-azure hover:bg-azure-dark"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Authenticate'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        Credentials are securely stored in Supabase
      </CardFooter>
    </Card>
  );
};

export default AzureAuthForm;
