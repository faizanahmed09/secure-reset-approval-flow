
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AzureCredentials {
  clientId: string;
  tenantId: string;
}

const AzureConfigForm = ({ onConfigComplete }: { onConfigComplete?: () => void }) => {
  const [credentials, setCredentials] = useState<AzureCredentials>({
    clientId: '',
    tenantId: '',
  });
  const { toast } = useToast();

  // Load saved credentials on mount
  useEffect(() => {
    const savedClientId = localStorage.getItem('azureClientId');
    const savedTenantId = localStorage.getItem('azureTenantId');
    
    if (savedClientId && savedTenantId) {
      setCredentials({
        clientId: savedClientId,
        tenantId: savedTenantId,
      });
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentials.clientId || !credentials.tenantId) {
      toast({
        title: "Validation Error",
        description: "Both Client ID and Tenant ID are required",
        variant: "destructive"
      });
      return;
    }

    // Save to localStorage
    localStorage.setItem('azureClientId', credentials.clientId);
    localStorage.setItem('azureTenantId', credentials.tenantId);
    
    toast({
      title: "Configuration Saved",
      description: "Your Azure AD credentials have been saved",
    });

    if (onConfigComplete) {
      onConfigComplete();
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Azure AD Configuration</CardTitle>
        <CardDescription>
          Enter your Azure Active Directory credentials to connect to Microsoft services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              name="clientId"
              value={credentials.clientId}
              onChange={handleChange}
              placeholder="Enter your Azure AD application client ID"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tenantId">Tenant ID</Label>
            <Input
              id="tenantId"
              name="tenantId"
              value={credentials.tenantId}
              onChange={handleChange}
              placeholder="Enter your Azure AD tenant ID"
            />
          </div>
          
          <Button type="submit" className="w-full">Save Configuration</Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        These credentials will be stored locally on your device
      </CardFooter>
    </Card>
  );
};

export default AzureConfigForm;
