import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, ShieldCheck, AlertCircle, CheckCircle, LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../authConfig';

type ResetRequestState = {
  email: string;
  status: 'idle' | 'loading' | 'approved' | 'error';
  message?: string;
};

const ResetApprovalForm = () => {
  const { instance, accounts } = useMsal();
  const [email, setEmail] = useState('');
  const [resetReq, setResetReq] = useState<ResetRequestState>({ email: '', status: 'idle' });
  const { toast } = useToast();

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


    setResetReq({ email, status: 'loading', message: 'Sending push…' });

    try {
    // Get token for Microsoft Graph API (using MSAL)
    const tokenResponse = await instance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });

    await sendPushNotificationToUser(email, tokenResponse.accessToken);

  } catch (error) {
    console.error('Error sending push notification:', error);
    setResetReq({
      email,
      status: 'error',
      message: 'Failed to send push notification. Please try again.',
    });
    toast({
      title: "Push Notification Failed",
      description: "Failed to send push notification",
      variant: "destructive",
    });
  }
  };

  const sendPushNotificationToUser = async (email: string, accessToken: string) => {
    try {
      // Call our API endpoint to send the MFA push
      const response = await fetch('/send-mfa-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, accessToken })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send MFA push');
      }
      
      const data = await response.json();
      
      setResetReq({
        email,
        status: 'loading',
        message: 'Approval request sent. Waiting for user response...'
      });
      
      // Start polling for authentication result
      startPollingForMFAStatus(email);
      
      return data;
    } catch (error) {
      console.error('Error sending push notification:', error);
      setResetReq({
        email,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      toast({
        title: "Push Notification Failed",
        description: error instanceof Error ? error.message : 'Failed to send push notification',
        variant: "destructive",
      });
      
      throw error;
    }
  };
  
  // Function to poll for authentication status
  const startPollingForMFAStatus = (email: string) => {
    // In a real implementation, you would store contextId, tenantId and token
    // For now, we'll simulate a response
    
    let pollingCount = 0;
    const maxPolls = 60; // Poll for up to 5 minutes (60 * 5s = 5 min)
    const pollingInterval = 5000; // 5 seconds
    
    const pollStatus = async () => {
      try {
        // In production, you would make a real API call here with the actual contextId
        // const response = await fetch('/api/check-mfa-status', { ... })
        
        // Simulate a response for demo purposes
        pollingCount++;
        
        if (pollingCount >= maxPolls) {
          setResetReq({
            email,
            status: 'error',
            message: 'Request timed out. The user did not respond within the time limit.'
          });
          
          toast({
            title: "Request Timeout",
            description: "The user did not respond within the time limit",
            variant: "destructive",
          });
          
          return;
        }
        
        // Simulate 70% chance of approval after a few polls
        if (pollingCount > 3 && Math.random() > 0.3) {
          setResetReq({
            email,
            status: 'approved',
            message: 'User has approved the request. You can proceed with account changes.'
          });
          
          toast({
            title: "Request Approved",
            description: "The user has approved your request",
            variant: "default",
          });
        } else {
          // Continue polling
          setTimeout(pollStatus, pollingInterval);
        }
      } catch (error) {
        console.error('Error polling for MFA status:', error);
        setResetReq({
          email,
          status: 'error',
          message: 'Failed to check approval status. Please try again.'
        });
        
        toast({
          title: "Status Check Failed",
          description: "Failed to check approval status",
          variant: "destructive",
        });
      }
    };
    
    // Start polling
    setTimeout(pollStatus, pollingInterval);
  };

  const handleLogout = () => {
    instance.logoutRedirect().catch(console.error);
    window.location.href = '/';
  };

  const renderStatus = () => {
    switch (resetReq.status) {
      case 'loading':
        return (
          <div className="mt-6 p-4 border rounded bg-muted flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p>{resetReq.message}</p>
          </div>
        );
      case 'approved':
        return (
          <div className="mt-6 p-4 border rounded bg-green-50 flex flex-col items-center">
            <ShieldCheck className="h-6 w-6 text-green-600 mb-2" />
            <p>{resetReq.message}</p>
          </div>
        );
      case 'error':
        return (
          <div className="mt-6 p-4 border rounded bg-red-50 flex flex-col items-center">
            <AlertCircle className="h-6 w-6 text-red-600 mb-2" />
            <p>{resetReq.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setResetReq({ email: '', status: 'idle' })}
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Reset Approval</CardTitle>
        <CardDescription className="text-center">
          Enter the user’s email to trigger approval
        </CardDescription>
      </CardHeader>

      <CardContent>
        {resetReq.status === 'idle' ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              <Send className="mr-2 h-4 w-4" />
              Send Approval
            </Button>
          </form>
        ) : (
          renderStatus()
        )}
      </CardContent>

      <CardFooter className="flex justify-center">
        {resetReq.status === 'idle' && 'User will receive a push notification.'}
      </CardFooter>

      <div className="mt-4 flex justify-center">
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </div>
    </Card>
  );
};

export default ResetApprovalForm;
