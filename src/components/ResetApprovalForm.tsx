
import { useState } from "react";
import { jwtDecode } from "jwt-decode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Loader2,
  ShieldCheck,
  AlertCircle,
  XCircle,
  Clock,
  UserX,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { loginRequest, clearAzureAuth } from "../authConfig";
import { Progress } from "@/components/ui/progress";

// Types
type RequestStatus = 
  | "idle" 
  | "loading" 
  | "approved" 
  | "denied" 
  | "timeout" 
  | "user_not_found" 
  | "error";

type ResetRequestState = {
  email: string;
  status: RequestStatus;
  message?: string;
  contextId?: string;
  progress?: number; // For the progress bar during polling
};

// Interface for JWT token payload
interface AzureJwtPayload {
  name?: string;
  preferred_username?: string;
  tid?: string; // Tenant ID
  oid?: string; // Object ID
  [key: string]: any; // Allow for other properties
}

// Constants for polling
const MAX_POLLS = 20;
const POLLING_INTERVAL = 5000; // 5 seconds

const ResetApprovalForm = () => {
  const { instance, accounts } = useMsal();
  const [email, setEmail] = useState("");
  const [resetReq, setResetReq] = useState<ResetRequestState>({
    email: "",
    status: "idle",
  });
  const { toast } = useToast();

  // Helper function to update request state
  const updateRequestState = (updates: Partial<ResetRequestState>) => {
    setResetReq(prev => ({ ...prev, ...updates }));
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    updateRequestState({ 
      email, 
      status: "loading", 
      message: "Preparing to send approval request...",
      progress: 10
    });

    try {
      // Get token for Microsoft Graph API (using MSAL)
      updateRequestState({ 
        message: "Authenticating with Microsoft Entra ID...",
        progress: 20
      });

      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      // Decode the idToken to extract user details
      const decodedToken = jwtDecode<AzureJwtPayload>(tokenResponse.idToken);
      console.log("Decoded Token:", decodedToken);

      // Extract relevant user details
      const userDetails = {
        name: decodedToken.name || "Unknown User", 
        email: decodedToken.preferred_username || tokenResponse.account?.username || "unknown@email.com", 
        tenantId: decodedToken.tid || "", 
        userObjectId: decodedToken.oid || "", 
      };

      updateRequestState({ 
        message: "Sending MFA push notification...",
        progress: 40 
      });

      // Send the push notification using the token and user details
      await sendPushNotificationToUser(email, userDetails, tokenResponse.accessToken);
    } catch (error) {
      console.error("Error sending push notification:", error);
      updateRequestState({
        status: "error",
        message: "Failed to send push notification. Please try again."
      });
      
      toast({
        title: "Push Notification Failed",
        description: "Failed to send push notification",
        variant: "destructive",
      });
    }
  };

  const sendPushNotificationToUser = async (
    email: string,
    userDetails: { name: string; email: string; tenantId?: string; userObjectId?: string },
    accessToken: string 
  ) => {
    try {
      // Calling Supabase Edge Function to send the MFA push
      const supabaseUrl = "https://lbyvutzdimidlzgbjstz.supabase.co";
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-mfa-push`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, userDetails, accessToken }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send MFA push");
      }

      const data = await response.json();
      
      // Handle immediate response cases
      if (!processInitialResponse(data, email)) {
        return data;
      }

      // Start polling for authentication result
      startPollingForMFAStatus(email, data.contextId);
      return data;
    } catch (error) {
      console.error("Error sending push notification:", error);
      updateRequestState({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });

      toast({
        title: "Push Notification Failed",
        description: error instanceof Error ? error.message : "Failed to send push notification",
        variant: "destructive",
      });

      throw error;
    }
  };

  // Process initial MFA response and return whether polling is needed
// Process initial MFA response and return whether polling is needed
const processInitialResponse = (data, email) => {
  // Check for immediate errors in the response
  if (data.result && !data.result.received) {
    updateRequestState({
      status: "error",
      message: "Failed to send MFA notification: " + (data.result.message || "Unknown error")
    });
    return false;
  }
  
  // Check for user not found error specifically
  if (data.result && data.result.message && data.result.message.includes("user not found")) {
    updateRequestState({
      status: "user_not_found",
      message: `User "${email}" not found in your organization or does not have MFA set up.`,
      contextId: data.contextId
    });
    return false;
  }
  
  // Check for tenant permission errors even when success is true
  if (data.result && data.result.message && 
      (data.result.message.includes("does not have access permissions") || 
       data.result.message.includes("tenant"))) {
    updateRequestState({
      status: "error",
      message: data.result.message,
      contextId: data.contextId
    });
    return false;
  }
  
  // Check for immediate approval/denial/timeout in the synchronous response
  if (data.result && data.result.approved) {
    updateRequestState({
      status: "approved",
      message: "User has instantly approved the request. You can proceed with account changes.",
      contextId: data.contextId
    });
    return false;
  }
  
  if (data.result && data.result.denied) {
    updateRequestState({
      status: "denied",
      message: "User has denied the request. No changes will be made.",
      contextId: data.contextId
    });
    return false;
  }
  
  if (data.result && data.result.timeout) {
    updateRequestState({
      status: "timeout",
      message: "Request timed out. The user did not respond within the time limit.",
      contextId: data.contextId
    });
    return false;
  }

  // If we get here, we need to start polling for the result
  updateRequestState({
    status: "loading",
    message: "Approval request sent. Waiting for user response...",
    contextId: data.contextId,
    progress: 60
  });
  
  return true;
};

  // Function to poll for authentication status
  const startPollingForMFAStatus = (email: string, contextId: string) => {
    let pollingCount = 0;

    const pollStatus = async () => {
      try {
        pollingCount++;
        
        // Update progress bar
        const progressValue = 60 + Math.min(35, (pollingCount / MAX_POLLS) * 40);
        updateRequestState({ progress: progressValue });

        if (pollingCount >= MAX_POLLS) {
          updateRequestState({
            status: "timeout",
            message: "Request timed out. The user did not respond within the time limit."
          });

          toast({
            title: "Request Timeout",
            description: "The user did not respond within the time limit",
            variant: "destructive",
          });

          return;
        }

        // In a real implementation, you'd make an API call to check the status
        // For now, we'll simulate different responses
        
        // Simulate responses based on email patterns
        if (email.includes("notfound")) {
          updateRequestState({
            status: "user_not_found",
            message: `User "${email}" not found in Azure AD or does not have MFA set up.`
          });
          return;
        }
        
        if (pollingCount >= 3) { // After a few polls, simulate a response
          if (email.includes("approve")) {
            // Simulate approval
            updateRequestState({
              status: "approved",
              message: "User has approved the request. You can proceed with account changes."
            });
            
            toast({
              title: "Request Approved",
              description: "The user has approved your request",
              variant: "default",
            });
            return;
          } else if (email.includes("deny")) {
            // Simulate denial
            updateRequestState({
              status: "denied",
              message: "User has denied the request. No changes will be made."
            });
            
            toast({
              title: "Request Denied",
              description: "The user has denied your request",
              variant: "destructive",
            });
            return;
          } else if (email.includes("timeout")) {
            // Simulate timeout
            updateRequestState({
              status: "timeout",
              message: "Request timed out. The user did not respond within the time limit."
            });
            
            toast({
              title: "Request Timeout",
              description: "The user did not respond within the time limit",
              variant: "destructive",
            });
            return;
          }
        }
        
        // Continue polling
        setTimeout(pollStatus, POLLING_INTERVAL);
      } catch (error) {
        console.error("Error polling for MFA status:", error);
        updateRequestState({
          status: "error",
          message: "Failed to check approval status. Please try again."
        });

        toast({
          title: "Status Check Failed",
          description: "Failed to check approval status",
          variant: "destructive",
        });
      }
    };

    // Start polling
    setTimeout(pollStatus, POLLING_INTERVAL);
  };

  const handleResetForm = () => {
    setResetReq({ email: "", status: "idle" });
    setEmail("");
  };

  const handleLogout = async () => {
    try {
      // Log out from MSAL
      instance.logoutRedirect().catch(console.error);

      // Clear Azure auth-related items from localStorage/sessionStorage
      clearAzureAuth();

      toast({
        title: "Logged Out Successfully",
        description: "You've been logged out from Azure AD",
      });

      // Navigate back to home page
      window.location.href = "/";
    } catch (error: any) {
      console.error("Error during logout:", error);
      toast({
        title: "Logout Error",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
    }
  };

  const renderStatus = () => {
    switch (resetReq.status) {
      case "loading":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-slate-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting for Response</h3>
            <p className="text-gray-600 text-center mb-4">{resetReq.message}</p>
            
            {resetReq.progress && (
              <div className="w-full max-w-md mt-2 mb-4">
                <Progress value={resetReq.progress} className="h-2" />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {Math.round(resetReq.progress)}% complete
                </p>
              </div>
            )}
            
            <Button 
              variant="outline"
              className="mt-2"
              onClick={handleResetForm}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Request
            </Button>
          </div>
        );
      
      case "approved":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-green-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Request Approved</h3>
            <p className="text-gray-600 text-center mb-4">{resetReq.message}</p>
            <div className="flex space-x-3">
              <Button 
                variant="default"
                onClick={handleResetForm}
                className="bg-green-600 hover:bg-green-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Send Another Request
              </Button>
            </div>
          </div>
        );
      
      case "denied":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-amber-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-amber-100 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Request Denied</h3>
            <p className="text-gray-600 text-center mb-4">
              {resetReq.message || "The user has denied your request. No changes will be made."}
            </p>
            <Button 
              variant="outline"
              onClick={handleResetForm}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Send Another Request
            </Button>
          </div>
        );
      
      case "timeout":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-orange-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-orange-100 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Request Timed Out</h3>
            <p className="text-gray-600 text-center mb-4">
              {resetReq.message || "The user did not respond within the time limit."}
            </p>
            <Button 
              variant="outline"
              onClick={handleResetForm}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Send Another Request
            </Button>
          </div>
        );
      
      case "user_not_found":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-red-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <UserX className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">User Not Found</h3>
            <p className="text-gray-600 text-center mb-4">
              {resetReq.message || `User "${resetReq.email}" was not found in Azure AD or does not have MFA set up.`}
            </p>
            <Button 
              variant="outline"
              onClick={handleResetForm}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Another Email
            </Button>
          </div>
        );
      
      case "error":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-red-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 text-center mb-4">{resetReq.message}</p>
            <Button 
              variant="outline"
              onClick={handleResetForm}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Help text component
  const getHelpText = () => {
    if (resetReq.status !== 'idle') return null;
    
    return (
      <div className="text-xs text-gray-500 mt-2">
        <div className="bg-muted/50 p-4 rounded-md border">
          <h3 className="text-sm font-medium mb-2">Process Information:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Enter the user's email address</li>
            <li>• System sends a secure push notification to the user</li>
            <li>• User approves or rejects the request</li>
            <li>• On approval, You can change the user's details</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <CardTitle className="text-center text-2xl">Change Request</CardTitle>
        <CardDescription className="text-center text-gray-600">
          Enter the user's email to trigger MFA approval
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        {resetReq.status === "idle" ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-700">User Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1"
                required
              />
              {getHelpText()}
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Send className="mr-2 h-4 w-4" />
              Send Approval Request
            </Button>
          </form>
        ) : (
          renderStatus()
        )}
      </CardContent>

      <CardFooter className="flex flex-col">
        {resetReq.status === "idle" && (
          <p className="text-sm text-gray-500 text-center">
            The user will receive a push notification on their mobile device requesting approval.
          </p>
        )}
        
        <div className="mt-6 pt-4 border-t w-full flex justify-center">
          <Button variant="destructive" onClick={handleLogout} size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ResetApprovalForm;
