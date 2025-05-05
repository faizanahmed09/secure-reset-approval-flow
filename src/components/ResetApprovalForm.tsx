import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ResetRequestState } from '@/types/azure-types';
import { Send, Loader2, ShieldCheck, AlertCircle, CheckCircle, LogOut } from 'lucide-react';
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
      // Get token for Microsoft Graph API (using MSAL)
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      // Call our API route to send the push notification
      const response = await fetch('/api/send-mfa-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send push notification');
      }

      console.log('Push notification response:', data);
      
      // Step 2: If we get here, the notification was sent successfully
      setResetRequest(prev => ({
        ...prev,
        message: 'Push notification sent. Waiting for user approval...',
        requestId: data.requestId
      }));
      
      // For demo purposes, simulate approval after a delay
      setTimeout(() => {
        setResetRequest(prev => ({
          ...prev,
          status: 'approved',
          message: 'User has approved the request'
        }));
        
        // Simulate completion after approval
        setTimeout(() => {
          setResetRequest(prev => ({
            ...prev,
            status: 'completed',
            message: 'Account changes have been successfully processed'
          }));
        }, 3000);
      }, 5000);
    } catch (error: any) {
      console.error('Error during request:', error);
      setResetRequest({
        email,
        status: 'error',
        message: error.message || 'Failed to process the reset request.'
      });
  
      toast({
        title: "Reset Request Failed",
        description: error.message || "An error occurred while processing the reset request",
        variant: "destructive"
      });
  
      // If token acquisition fails, fallback to redirect
      if (error.name === "InteractionRequiredAuthError") {
        instance.acquireTokenRedirect(loginRequest);
      }
    }
  };
  
  // Function to trigger push notification for approval via Microsoft Authenticator
  const sendPushNotificationToUser = async (email: string, accessToken: string) => {
    try {
      
      // Try to get the user's authentication methods using the correct Graph API endpoint
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodedEmail}/authentication/methods`, {
        method: 'GET', 
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching authentication methods:', errorData);
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const methods = await response.json();
      console.log('Available authentication methods:', methods);
      
      // Check if the user has Microsoft Authenticator set up
      const authenticatorMethod = methods.value.find(
        method => method['@odata.type'] === '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod'
      );
      
      // if (!authenticatorMethod) {
      //   console.log('Microsoft Authenticator not set up for this user');
      //   throw new Error('Microsoft Authenticator is not configured for this user account. Please set up the Microsoft Authenticator app for your account before using this feature.');
      // }
      
      // In a real implementation with Authenticator properly set up, we would use the authenticator ID to send a notification
      // const authenticatorId = '28c10230-6103-485e-b985-444c60001490';
      
      // // Here we would make an actual API call to send the push notification
      // // This would be something like:
      // const notificationResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodedEmail}/authentication/passwordAuthenticationMethod/${authenticatorId}/sendNotification`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${accessToken}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     notificationTitle: "Account Reset Request",
      //     notificationMessage: "Tap to approve the account reset request"
      //   })
      // });
      
      // console.log(notificationResponse,'Push notification sent successfully');
      
    } catch (error) {
      console.error('Error during push notification:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  };  

  const getUserDetails = async (email: string, accessToken: string) => {
    try {
      // Format the email for URL encoding if needed
      const encodedEmail = encodeURIComponent(email);
      
      // Try to get the user's authentication methods using the correct Graph API endpoint
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodedEmail}`, {
        method: 'GET', 
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error fetching authentication methods:', errorData);
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const userDetails = await response.json();
      console.log('User details:', userDetails);
      return userDetails;

    } catch (error) {
      console.error('Error during push notification:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  }
  
  // Function to handle account change after user approval
  const handleAccountChange = (email: string) => {
    // Implement your logic here to update the account or make changes after user approval
    console.log(`Account change initiated for: ${email}`);
  };
  
  const handleLogout = () => {
    instance.logoutRedirect().catch((error) => {
      console.error('Logout error:', error);
    });

    window.location.href = '/';
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
            <p className="text-sm text-muted-foreground mt-2">Processing account reset...</p>
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
              <h3 className="font-medium text-green-600">Request Complete</h3>
            </div>
            <p className="text-sm">{resetRequest.message}</p>
            <Button 
              className="mt-4 bg-green-600 hover:bg-green-700"
              onClick={() => setResetRequest({ email: '', status: 'idle' })}
            >
              Another Request
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
        <CardTitle className="text-center text-2xl">Reset Approval</CardTitle>
        <CardDescription className="text-center">
          Enter the user's email to trigger a request
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
              Approve Request
            </Button>
          </form>
        ) : (
          renderStatusContent()
        )}
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        {resetRequest.status === 'idle' && "User will receive a push notification to approve"}
      </CardFooter>

      <div className="mt-4 w-full flex justify-center">
        <Button 
          onClick={handleLogout} 
          className="bg-red-600 hover:bg-red-700"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </div>
    </Card>
  );
};

export default ResetApprovalForm;
