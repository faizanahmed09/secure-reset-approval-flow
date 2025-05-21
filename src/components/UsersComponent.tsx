'use client';
import { useState, useEffect, useRef } from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest, graphConfig } from '../authConfig';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

const UsersComponent = () => {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const fetchCalled = useRef(false);

  useEffect(() => {
    if (inProgress === "none" && isAuthenticated && accounts.length > 0) {
      if (!fetchCalled.current) {
        fetchCalled.current = true;
        fetchUsers();
      }
    } else if (inProgress === "none" && !isAuthenticated) {
      instance.loginRedirect(loginRequest);
    }
  }, [inProgress, isAuthenticated, accounts]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      const response = await axios.get(graphConfig.graphUsersEndpoint, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });
      
      setUsers(response.data.value);
      toast({
        title: "Users Loaded",
        description: `Successfully loaded ${response.data.value.length} users from Azure AD`,
        duration: 1500,
      });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error Fetching Users",
        description: "Failed to fetch users from Azure AD",
        variant: "destructive",
      });
      
      // If silent token acquisition fails, fallback to redirect
      if (error.name === "InteractionRequiredAuthError") {
        instance.acquireTokenRedirect(loginRequest);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8">
      <Button 
        variant="outline" 
        className="mb-6" 
        onClick={() => router.push('/')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Button>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-6 w-6 text-blue-600" />
            <span>Azure AD Users</span>
          </CardTitle>
          <CardDescription>Users from your Azure Active Directory</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user: AzureUser) => (
                <div key={user.id} className="p-4 border rounded-md bg-muted/30 flex flex-col">
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-sm text-muted-foreground">{user.userPrincipalName}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No users found or insufficient permissions
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersComponent;
