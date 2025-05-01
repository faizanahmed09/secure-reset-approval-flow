
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ResetRequestState } from '@/types/azure-types';
import { Send, Loader2, ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

const ResetApprovalForm = () => {
  const { instance, accounts } = useMsal();
  const [email, setEmail] = useState('');
  const [resetRequest, setResetRequest] = useState<ResetRequestState>({
    email: '',
    status: 'idle',
  });
  const { toast } = useToast();
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };
  
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    
    // Set status to loading and store the email
    setResetRequest({
      email,
      status: 'loading',
      message: 'Sending push notification to user...'
    });
    
    try {
      // Get token for Microsoft Graph API
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      
      // In a real scenario, you would call the Microsoft Graph API here
      // For demo purposes, we'll simulate the flow
      console.log(`Token acquired successfully for user ${accounts[0].username}`);
      console.log(`Would send password reset request for: ${email}`);
      
      // Step 1: Simulate sending push notification
      setTimeout(() => {
        setResetRequest(prev => ({
          ...prev,
          message: 'Push notification sent. Waiting for user approval...'
        }));
        
        // Step 2: Simulate user approval (after 3 seconds)
        setTimeout(() => {
          setResetRequest({
            email,
            status: 'approved',
            message: 'User approved the password reset request.'
          });
          
          toast({
            title: "Request Approved",
            description: "User has approved the password reset request",
          });
          
          // Step 3: Simulate password reset completion (after 2 more seconds)
          setTimeout(() => {
            setResetRequest({
              email,
              status: 'completed',
              message: 'Password has been reset successfully.'
            });
            
            toast({
              title: "Password Reset Complete",
              description: `Password for ${email} has been reset successfully`,
              variant: "default"
            });
          }, 2000);
        }, 3000);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error during password reset request:', error);
      setResetRequest({
        email,
        status: 'error',
        message: 'Failed to process the password reset request.'
      });
      
      toast({
        title: "Reset Request Failed",
        description: "An error occurred while processing the password reset request",
        variant: "destructive"
      });
      
      // If token acquisition fails, fallback to redirect
      if (error.name === "InteractionRequiredAuthError") {
        instance.acquireTokenRedirect(loginRequest);
      }
    }
  };
  
  // Render different status content based on the request state
  const renderStatusContent = () => {
    switch(resetRequest.status) {
      case 'loading':
        return (
          <div className="mt-6 p-4 border rounded-md bg-muted flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              <h3 className="font-medium">Processing Request</h3>
            </div>
            <p className="text-sm text-muted-foreground">{resetRequest.message}</p>
          </div>
        );
        
      case 'approved':
        return (
          <div className="mt-6 p-4 border rounded-md bg-green-50 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <ShieldCheck className="h-6 w-6 text-green-600" />
              <h3 className="font-medium text-green-600">Request Approved</h3>
            </div>
            <p className="text-sm">{resetRequest.message}</p>
            <p className="text-sm text-muted-foreground mt-2">Resetting password...</p>
            <div className="w-full h-2 bg-muted mt-4 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 animate-pulse w-3/4"></div>
            </div>
          </div>
        );
        
      case 'completed':
        return (
          <div className="mt-6 p-4 border rounded-md bg-green-50 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h3 className="font-medium text-green-600">Password Reset Complete</h3>
            </div>
            <p className="text-sm">{resetRequest.message}</p>
            <Button 
              className="mt-4 bg-green-600 hover:bg-green-700"
              onClick={() => setResetRequest({ email: '', status: 'idle' })}
            >
              Reset Another Password
            </Button>
          </div>
        );
        
      case 'error':
        return (
          <div className="mt-6 p-4 border rounded-md bg-red-50 flex flex-col items-center">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h3 className="font-medium text-red-600">Error</h3>
            </div>
            <p className="text-sm">{resetRequest.message}</p>
            <Button 
              variant="outline" 
              className="mt-4 border-red-300 text-red-600 hover:text-red-600 hover:bg-red-50"
              onClick={() => setResetRequest({ email: '', status: 'idle' })}
            >
              Try Again
            </Button>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Card className="w-full max-w-md security-card">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Password Reset Approval</CardTitle>
        <CardDescription className="text-center">
          Enter the user's email to trigger a password reset request
        </CardDescription>
      </CardHeader>
      <CardContent>
        {resetRequest.status === 'idle' ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <Input 
                id="email"
                type="email"
                placeholder="Enter the user's email address"
                value={email}
                onChange={handleEmailChange}
                required
                className="border-blue-100 focus:border-blue-500"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Send className="mr-2 h-4 w-4" />
              Approve Password Reset
            </Button>
          </form>
        ) : (
          renderStatusContent()
        )}
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        {resetRequest.status === 'idle' && "User will receive a push notification to approve"}
      </CardFooter>
    </Card>
  );
};

export default ResetApprovalForm;
