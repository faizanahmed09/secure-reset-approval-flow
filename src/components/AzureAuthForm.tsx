
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AzureADCredentials } from '@/types/azure-types';
import { Lock, Key, Building, Loader2 } from 'lucide-react';

const AzureAuthForm = () => {
  const [credentials, setCredentials] = useState<AzureADCredentials>({
    clientId: '',
    clientSecret: '',
    tenantId: '',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // For this demo, we'll simulate a successful authentication after a short delay
    setTimeout(() => {
      console.log('Authenticating with Azure AD:', credentials);
      
      // In a real app, we would make an API call to authenticate with Azure AD
      // and store the token in Supabase
      
      // Mock successful authentication
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9';
      localStorage.setItem('azure_token', mockToken);
      
      toast({
        title: "Authentication Successful",
        description: "You've been authenticated with Azure AD",
      });
      
      setLoading(false);
      navigate('/reset-approval');
    }, 2000);
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
