import { useState, useEffect, useRef, useCallback } from "react";
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
  Search,
} from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { loginRequest, clearAzureAuth, graphConfig } from "../userAuthConfig";
import axios from "axios";
import Loader from "@/components/common/Loader";
import debounce from 'lodash/debounce';
import { getAccessToken } from '@/services/userService';
import { tokenInterceptor } from '@/utils/tokenInterceptor';

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
  progress?: number;
};

// Interface for JWT token payload
interface AzureJwtPayload {
  name?: string;
  preferred_username?: string;
  tid?: string;
  oid?: string;
  [key: string]: any;
}

const ResetApprovalForm = () => {
  const { instance, accounts } = useMsal();
  const [email, setEmail] = useState("");
  const [resetReq, setResetReq] = useState<ResetRequestState>({
    email: "",
    status: "idle",
  });

  // Enhanced states for server-side search
  const [searchResults, setSearchResults] = useState<AzureUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Remove the automatic login redirect since authentication is handled at the page level

  // Optimized field selection for search
  const selectFields = ['displayName', 'userPrincipalName'].join(',');

  // Server-side search function with improved token handling
  const searchUsers = async (query: string): Promise<AzureUser[]> => {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    try {
      // Cancel previous search request
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      
      // Create new AbortController for this search
      searchAbortControllerRef.current = new AbortController();

      // Initialize token interceptor
      tokenInterceptor.initialize(instance, accounts);

      // Build search filter - search in displayName, userPrincipalName, and mail
      const searchFilter = `startswith(displayName,'${query}') or startswith(userPrincipalName,'${query}')`;
      
      // Note: $orderby is not supported with complex $filter queries in Microsoft Graph
      const endpoint = `${graphConfig.graphUsersEndpoint}?$select=${selectFields}&$filter=${encodeURIComponent(searchFilter)}&$top=20`;

      // Use tokenInterceptor's fetch method for automatic token handling
      const response = await tokenInterceptor.graphApiFetch(endpoint, {
        headers: {
          'ConsistencyLevel': 'eventual',
        },
        signal: searchAbortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value || [];
    } catch (error: any) {
      // Don't handle error if request was cancelled
      if (error.name === 'AbortError') {
        return [];
      }

      console.error("Error searching users:", error);
      
      // Let the tokenInterceptor handle authentication errors
      tokenInterceptor.handleGraphApiError(error, 'searchUsers');
      
      // Handle specific error cases
      if (error.message?.includes('AUTHENTICATION')) {
        throw new Error("Authentication required - please refresh the page");
      } else if (error.message?.includes('permissions')) {
        throw new Error("Insufficient permissions to search users");
      } else {
        throw new Error("Failed to search users");
      }
    }
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setSearchError("");

      try {
        const results = await searchUsers(query);
        setSearchResults(results);
        setShowDropdown(true);
        
        // Show helpful message if no results found
        if (results.length === 0) {
          setSearchError(`No users found matching "${query}"`);
        }
      } catch (error: any) {
        console.error("Search error:", error);
        setSearchError(error.message || "Search failed");
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [instance, accounts]
  );

  // Handle email input change with server-side search
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setSearchError("");

    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      // Cancel any pending search
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      return;
    }

    // Trigger debounced search
    debouncedSearch(val);
  };

  // When user clicks a dropdown item
  const handleUserClick = (user: AzureUser) => {
    setEmail(user.userPrincipalName);
    setShowDropdown(false);
    setSearchResults([]);
    setSearchError("");
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (email.trim() && searchResults.length > 0) {
      setShowDropdown(true);
    }
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

    // Cancel any ongoing search
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    setShowDropdown(false);

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    updateRequestState({ 
      email, 
      status: "loading", 
      message: "Preparing to send approval request..."
    });

    try {
      // Get token for Microsoft Graph API
      updateRequestState({ 
        message: "Authenticating with Microsoft Entra ID..."
      });

      // Initialize token interceptor and get access token
      tokenInterceptor.initialize(instance, accounts);
      const accessToken = await tokenInterceptor.getValidAccessToken();

      // Check if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Get the idToken from session storage to extract user details
      const idToken = typeof window !== 'undefined' ? window.sessionStorage.getItem('idToken') : null;
      if (!idToken) {
        throw new Error("No ID token available");
      }
      
      const decodedToken = jwtDecode<AzureJwtPayload>(idToken);

      // Extract relevant user details
      const userDetails = {
        name: decodedToken.name || "Unknown User", 
        email: decodedToken.preferred_username || "unknown@email.com", 
        tenantId: decodedToken.tid || "", 
        userObjectId: decodedToken.oid || "", 
      };

      updateRequestState({ 
        message: "Sending MFA push notification..."
      });

      // Send the push notification using the token and user details
      await sendPushNotificationToUser(email, userDetails, accessToken);
    } catch (error: any) {
      // Don't show error if request was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      console.error("Error sending push notification:", error);
      
      // Handle authentication errors via token interceptor
      tokenInterceptor.handleGraphApiError(error, 'resetApprovalRequest');
      
      // Check if it's an authentication error that will redirect
      if (error.message === 'AUTHENTICATION_REQUIRED' || 
          error.message === 'AUTHENTICATION_FAILED') {
        // Don't show additional error message as redirect will happen
        return;
      }
      
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

      if (data.result && data.result.received && 
          !data.result.approved && !data.result.denied && !data.result.timeout &&
          data.result.message && data.result.message.trim() !== "") {
        updateRequestState({
          status: "mfa_not_configured", 
          message: `MFA configuration issue: ${data.result.message}`,
          contextId: data.contextId
        });
        return false;
      }

      
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

      updateRequestState({
        status: "loading",
        message: "Approval request sent. Waiting for user response...",
        contextId: data.contextId
      });
      
      return true;
  };

  const handleResetForm = () => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }

    // Reset state
    setResetReq({ email: "", status: "idle" });
    setEmail("");
    setSearchResults([]);
    setShowDropdown(false);
    setSearchError("");
    setIsSearching(false);
  };

  const handleLogout = async () => {
    try {
      // Cancel any ongoing requests before logout
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }

      instance.logoutRedirect().catch(console.error);
      clearAzureAuth();

      toast({
        title: "Logged Out Successfully",
        description: "You've been logged out from Azure AD",
      });

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

  // Cleanup AbortControllers on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
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

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <CardTitle className="text-center text-2xl">Change Request</CardTitle>
        <CardDescription className="text-center text-gray-600">
          Search and select a user to trigger MFA approval
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        {resetReq.status === "idle" ? (
          <form onSubmit={handleResetRequest} className="space-y-4" autoComplete="off">
            <div className="relative" ref={dropdownRef}>
              <Label htmlFor="email" className="text-gray-700">
                User Email
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={handleInputFocus}
                  placeholder="Start typing to search users..."
                  className="mt-1 pl-10"
                  required
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-white shadow-lg">
                  {searchResults.length > 0 ? (
                    searchResults.map((user, index) => (
                      <div
                        key={`${user.id}-${user.userPrincipalName}-${index}`}
                        className="cursor-pointer px-3 py-2 hover:bg-blue-100 transition-colors"
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="font-medium">{user.displayName}</div>
                        <div className="text-sm text-gray-500">{user.userPrincipalName}</div>
                        {user.mail && user.mail !== user.userPrincipalName && (
                          <div className="text-xs text-blue-600">{user.mail}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      {searchError || (email.length < 2 ? "Type at least 2 characters to search" : "No users found")}
                    </div>
                  )}
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

        {resetReq.status === 'idle' && (
          <div className="text-xs text-gray-500 mt-2">
            <div className="bg-muted/50 p-4 rounded-md border">
              <h3 className="text-sm font-medium mb-2">Process Information:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li key="search-process">• Search for users across your organization</li>
                <li key="notification-process">• System sends a secure push notification to the user</li>
                <li key="approval-process">• User approves or rejects the request</li>
                <li key="change-process">• On approval, you can change the user's details</li>
              </ul>
            </div>
          </div>
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