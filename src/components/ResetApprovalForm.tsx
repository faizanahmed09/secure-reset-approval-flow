import { useState, useEffect, useRef } from "react";
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
import { loginRequest, clearAzureAuth, graphConfig } from "../authConfig";
import { Progress } from "@/components/ui/progress";
import axios from "axios";
import Loader from "@/components/common/Loader";

interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

// Types
type RequestStatus = 
  | "idle" 
  | "loading" 
  | "approved" 
  | "denied" 
  | "timeout" 
  | "user_not_found" 
  | "mfa_not_configured"
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


const ResetApprovalForm = () => {
  const { instance, accounts } = useMsal();
  const [email, setEmail] = useState("");
  const [resetReq, setResetReq] = useState<ResetRequestState>({
    email: "",
    status: "idle",
  });

  // New states for users and filtered users dropdown
  const [allUsers, setAllUsers] = useState<AzureUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AzureUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const fetchedUsersRef = useRef(false);

  // Add AbortController ref to manage request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (accounts.length > 0 && !fetchedUsersRef.current) {
      fetchedUsersRef.current = true;
      fetchUsers();
    } else if (accounts.length === 0) {
      instance.loginRedirect(loginRequest);
    }
  }, [accounts]);

  // Fetch Azure AD users
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      const response = await axios.get(graphConfig.graphUsersEndpoint, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });

      setAllUsers(response.data.value);
      setFilteredUsers(response.data.value);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error Fetching Users",
        description: "Failed to fetch users from Azure AD",
        variant: "destructive",
      });

      if (error.name === "InteractionRequiredAuthError") {
        instance.acquireTokenRedirect(loginRequest);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  // Update email input and filter dropdown list
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);

    if (!val) {
      setFilteredUsers(allUsers);
      setShowDropdown(false);
      return;
    }

    const filtered = allUsers.filter((user) =>
      user.userPrincipalName.toLowerCase().includes(val.toLowerCase())
    );
    setFilteredUsers(filtered);
    setShowDropdown(true);
  };

  // When user clicks a dropdown item
  const handleUserClick = (user: AzureUser) => {
    setEmail(user.userPrincipalName);
    setShowDropdown(false);
  };

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper function to update request state (with abort check)
  const updateRequestState = (updates: Partial<ResetRequestState>) => {
    // Only update state if the request hasn't been cancelled
    if (abortControllerRef.current && abortControllerRef.current.signal.aborted) {
      return;
    }
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

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    updateRequestState({ 
      email, 
      status: "loading", 
      message: "Preparing to send approval request..."
    });

    try {
      // Get token for Microsoft Graph API (using MSAL)
      updateRequestState({ 
        message: "Authenticating with Microsoft Entra ID..."
      });

      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      // Check if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Decode the idToken to extract user details
      const decodedToken = jwtDecode<AzureJwtPayload>(tokenResponse.idToken);

      // Extract relevant user details
      const userDetails = {
        name: decodedToken.name || "Unknown User", 
        email: decodedToken.preferred_username || tokenResponse.account?.username || "unknown@email.com", 
        tenantId: decodedToken.tid || "", 
        userObjectId: decodedToken.oid || "", 
      };

      updateRequestState({ 
        message: "Sending MFA push notification..."
      });

      // Send the push notification using the token and user details
      await sendPushNotificationToUser(email, userDetails, tokenResponse.accessToken);
    } catch (error) {
      // Don't show error if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

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
      // Check if request was cancelled before making the API call
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

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
          signal: abortControllerRef.current?.signal, // Pass abort signal to fetch
        }
      );

      // Check if request was cancelled after fetch
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send MFA push");
      }

      const data = await response.json();
      
      // Handle immediate response cases
      if (!processInitialResponse(data, email)) {
        return data;
      }

    } catch (error) {
      // Don't handle error if request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
        return;
      }

      // Don't update state if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

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
const processInitialResponse = (data: any, email : string) => {
  // Check if request was cancelled
  if (abortControllerRef.current?.signal.aborted) {
    return false;
  }

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
      message: `User "${email}" not found in your organization.`,
      contextId: data.contextId
    });
    return false;
  }

  // NEW: Check for "No default authentication method" error
  if (data.result && data.result.message && 
      (data.result.message.includes("No default authentication method") || 
       data.result.message.includes("authentication method is set"))) {
    updateRequestState({
      status: "mfa_not_configured",
      message: `User "${email}" exists but does not have MFA configured. Please set up multi-factor authentication for this user first.`,
      contextId: data.contextId
    });
    return false;
  }

  // NEW: Check for other MFA configuration errors
  if (data.result && data.result.received && 
      !data.result.approved && !data.result.denied && !data.result.timeout &&
      data.result.message && data.result.message.trim() !== "") {
    // This catches cases where the request was received but failed due to MFA setup issues
    updateRequestState({
      status: "mfa_not_configured", 
      message: `MFA configuration issue: ${data.result.message}`,
      contextId: data.contextId
    });
    return false;
  }

  // Check if user has SMS MFA but we need push notification
  if (data.result && data.result.received && data.result.message && 
      (data.result.message.includes("SMS MFA configured") || 
      data.result.message.includes("push notifications are not available"))) {
    updateRequestState({
      status: "mfa_not_configured",
      message: `User "${email}" has SMS-based MFA configured. Push notifications are only available for users with Microsoft Authenticator app or similar push-capable MFA methods.`,
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
      message: "User has approved the request. You can proceed with account changes.",
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
    contextId: data.contextId
  });
  
  return true;
};

  const handleResetForm = () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset state
    setResetReq({ email: "", status: "idle" });
    setEmail("");
  };

  const handleLogout = async () => {
    try {
      // Cancel any ongoing request before logout
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

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

  // Cleanup AbortController on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const renderStatus = () => {
    switch (resetReq.status) {
      case "loading":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-slate-50 flex flex-col items-center">
            <Loader />
            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">Waiting for Response</h3>
            <p className="text-gray-600 text-center mb-4">{resetReq.message}</p>
            
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

      case "mfa_not_configured":
        return (
          <div className="mt-6 p-6 border rounded-lg bg-yellow-50 flex flex-col items-center">
            <div className="w-16 h-16 mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">MFA Not Configured</h3>
            <p className="text-gray-600 text-center mb-4">
              {resetReq.message || `User "${resetReq.email}" exists but does not have MFA set up.`}
            </p>
            <div className="bg-yellow-100 p-3 rounded-md mb-4 max-w-sm">
              <p className="text-sm text-yellow-800 text-center">
                Ask the user to set up MFA in their Microsoft account settings before trying again.
              </p>
            </div>
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
          <form onSubmit={handleResetRequest} className="space-y-4" autoComplete="off">
            <div className="relative" ref={dropdownRef}>
              <Label htmlFor="email" className="text-gray-700">
                User Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="user@example.com"
                className="mt-1"
                required
                autoComplete="off"
                onFocus={() => {
                  if (email) setShowDropdown(true);
                }}
              />
              {/* Dropdown for filtered users */}
              {showDropdown && filteredUsers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-white shadow-lg">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="cursor-pointer px-3 py-2 hover:bg-blue-100"
                      onClick={() => handleUserClick(user)}
                    >
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-sm text-gray-500">{user.userPrincipalName}</div>
                    </div>
                  ))}
                </div>
              )}
              {showDropdown && filteredUsers.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg px-3 py-2 text-sm text-gray-500">
                  No users found
                </div>
              )}
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
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