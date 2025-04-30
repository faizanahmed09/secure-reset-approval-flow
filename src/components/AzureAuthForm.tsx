
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Lock, Key, Building, Loader2 } from 'lucide-react';

// Define the credential interface without Supabase dependencies
interface AzureADCredentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

// Define a simplified auth state
interface AuthState {
  isAuthenticated: boolean;
  token?: string;
  error?: string;
}

const AzureAuthForm = () => {
  const [credentials, setCredentials] = useState<AzureADCredentials>({
    clientId: '',
    clientSecret: '',
    tenantId: '',
  });
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Direct API call to Azure AD to get a token
      const tokenUrl = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;
      
      const formData = new URLSearchParams();
      formData.append('client_id', credentials.clientId);
      formData.append('scope', 'https://graph.microsoft.com/.default');
      formData.append('client_secret', credentials.clientSecret);
      formData.append('grant_type', 'client_credentials');
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Azure AD token error:", errorText);
        setAuthState({
          isAuthenticated: false,
          error: "Failed to authenticate with Azure AD",
        });
        toast({
          title: "Authentication Failed",
          description: "Failed to authenticate with Azure AD. Please check your credentials.",
          variant: "destructive",
        });
      } else {
        const data = await response.json();
        
        console.log('Azure AD authentication successful:', data);
        setAuthState({
          isAuthenticated: true,
          token: data.access_token,
        });
        
        // Store token in session storage (not persisted)
        sessionStorage.setItem('azureToken', data.access_token);
        sessionStorage.setItem('azureTokenExpiry', (Date.now() + data.expires_in * 1000).toString());
        
        toast({
          title: "Authentication Successful",
          description: "You've been authenticated with Azure AD",
        });
        
        // Redirect to reset approval page
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
        Credentials are used only for authentication, not stored
      </CardFooter>
    </Card>
  );
};

export default AzureAuthForm;
