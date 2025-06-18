'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, Edit, Save, X, Search, Plus, UserPlus, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { BeautifulLoader } from '@/app/loader';
import { fetchOrganizationUsers, updateUser, searchAzureUsers, createDatabaseUser } from '@/services/userService';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/userAuthConfig';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface User {
  id: string;
  email: string;
  name: string;
  tenant_id: string;
  client_id: string;
  last_login_at: string;
  is_active: boolean;
  role: 'admin' | 'verifier' | 'basic';
  organizations?: {
    display_name: string;
  };
}

interface EditingUser {
  id: string;
  is_active: boolean;
  role: 'admin' | 'verifier' | 'basic';
}

interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

const ApplicationUsers = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { instance, accounts } = useMsal();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Azure user search states
  const [searchQuery, setSearchQuery] = useState('');
  const [azureUsers, setAzureUsers] = useState<AzureUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'verifier' | 'basic'>('basic');
  const [creatingUser, setCreatingUser] = useState(false);
  const [authError, setAuthError] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUsers();
    }
  }, [isAuthenticated, user]);

  // Monitor authentication state and handle session expiration
  useEffect(() => {
    const checkAuthState = () => {
      // If we were authenticated but now we're not, and we're not currently loading
      if (!isLoading && !isAuthenticated) {
        // Check if tokens exist in session storage
        const idToken = typeof window !== 'undefined' ? window.sessionStorage.getItem('idToken') : null;
        const accessToken = typeof window !== 'undefined' ? window.sessionStorage.getItem('accessToken') : null;
        
        // If no tokens, redirect to index page
        if (!idToken && !accessToken) {
          console.log('No authentication tokens found, redirecting to index page');
          toast({
            title: 'Session Expired',
            description: 'Your session has expired. Redirecting to login...',
          });
          
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      }
    };

    checkAuthState();
  }, [isAuthenticated, isLoading]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      if (!user?.organization_id) {
        throw new Error('No organization found');
      }

      const users = await fetchOrganizationUsers(user.organization_id);
      setUsers(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser({
      id: user.id,
      is_active: user.is_active,
      role: user.role,
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    try {
      setSaving(true);
      
      const updatedUser = await updateUser(editingUser.id, {
        is_active: editingUser.is_active,
        role: editingUser.role,
      });

      // Update local state
      setUsers(users.map(user => 
        user.id === editingUser.id 
          ? { ...user, is_active: editingUser.is_active, role: editingUser.role }
          : user
      ));

      setEditingUser(null);
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSearchAzureUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setAzureUsers([]);
      setAuthError(false);
      return;
    }

    try {
      setSearchLoading(true);
      setAuthError(false);
      
      const results = await searchAzureUsers(instance, accounts, query);
      setAzureUsers(results);
    } catch (error: any) {
      console.error('Error searching Azure users:', error);
      
      if (error.message === 'INTERACTION_REQUIRED') {
        setAuthError(true);
        toast({
          title: 'Authentication Required',
          description: 'Your session has expired. Please re-authenticate to search users.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('No authentication available') || error.message?.includes('token')) {
        // Token completely expired, redirect to index page
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Redirecting to login...',
          variant: 'destructive',
        });
        
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to search Azure users',
          variant: 'destructive',
        });
      }
      
      setAzureUsers([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReAuthenticate = async () => {
    try {
      setAuthError(false);
      
      // Check if we have accounts available
      if (!accounts || accounts.length === 0) {
        // No accounts available, redirect to index page for fresh login
        toast({
          title: 'Authentication Required',
          description: 'Redirecting to login page...',
        });
        window.location.href = '/';
        return;
      }
      
      await instance.acquireTokenRedirect({
        ...loginRequest,
        account: accounts[0],
      });
    } catch (error) {
      console.error('Re-authentication failed:', error);
      toast({
        title: 'Authentication Error',
        description: 'Redirecting to login page...',
        variant: 'destructive',
      });
      
      // Fallback: redirect to index page
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
  };

  const handleCreateUser = async (azureUser: AzureUser) => {
    if (!user?.organization_id || !user?.tenant_id || !user?.client_id) {
      toast({
        title: 'Error',
        description: 'Missing organization, tenant, or client information',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreatingUser(true);
      
      const newUser = await createDatabaseUser(
        azureUser,
        selectedRole,
        user.organization_id,
        user.tenant_id,
        user.client_id
      );

      // Add to local state
      setUsers([newUser, ...users]);
      
      // Reset dialog state
      setShowAddUserDialog(false);
      setSearchQuery('');
      setAzureUsers([]);
      setSelectedRole('basic');
      setAuthError(false);

      toast({
        title: 'Success',
        description: `User ${azureUser.displayName} created successfully`,
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearchAzureUsers(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin-portal">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portal
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Application Users
            </h1>
            <p className="text-muted-foreground">
              Manage users in your organization
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users List</CardTitle>
              <CardDescription>
                {isAdmin 
                  ? "View and manage all users in your organization" 
                  : "View users in your organization"
                }
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Search for Azure AD users and add them to your organization
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* Authentication Error Alert */}
                    {authError && (
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800">Authentication Required</p>
                          <p className="text-sm text-yellow-700">You need to re-authenticate to search users.</p>
                        </div>
                        <Button size="sm" onClick={handleReAuthenticate}>
                          Re-authenticate
                        </Button>
                      </div>
                    )}

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search Azure AD users (type 2+ characters)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        disabled={authError}
                      />
                      {searchLoading && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        </div>
                      )}
                    </div>

                    {/* Role Selection */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Default Role for New User</label>
                      <Select value={selectedRole} onValueChange={(value: 'admin' | 'verifier' | 'basic') => setSelectedRole(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="verifier">Verifier</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Search Results */}
                    {searchQuery.length >= 2 && !authError && (
                      <div className="border rounded-lg max-h-96 overflow-y-auto">
                        {searchLoading ? (
                          <div className="p-4 text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-sm text-muted-foreground mt-2">Searching...</p>
                          </div>
                        ) : azureUsers.length > 0 ? (
                          <div className="divide-y">
                            {azureUsers.map((azureUser) => {
                              // Check if user already exists
                              const userExists = users.some(u => u.email === azureUser.userPrincipalName);
                              
                              return (
                                <div key={azureUser.id} className="p-4 hover:bg-muted/50">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium">{azureUser.displayName}</p>
                                      <p className="text-sm text-muted-foreground">{azureUser.userPrincipalName}</p>
                                      {azureUser.mail && azureUser.mail !== azureUser.userPrincipalName && (
                                        <p className="text-sm text-blue-600">{azureUser.mail}</p>
                                      )}
                                      {userExists && (
                                        <Badge variant="outline" className="text-xs mt-1">
                                          Already exists
                                        </Badge>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={() => handleCreateUser(azureUser)}
                                      disabled={creatingUser || userExists}
                                    >
                                      {creatingUser ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      ) : userExists ? (
                                        'Exists'
                                      ) : (
                                        <>
                                          <Plus className="h-4 w-4 mr-1" />
                                          Add
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : searchQuery.length >= 2 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No users found matching "{searchQuery}"</p>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {searchQuery.length < 2 && searchQuery.length > 0 && (
                      <div className="text-center text-muted-foreground p-4">
                        <p>Type at least 2 characters to search</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <BeautifulLoader />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Tenant ID</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="font-mono text-sm">{user.tenant_id}</TableCell>
                      <TableCell>{user.organizations?.display_name || 'N/A'}</TableCell>
                      <TableCell>
                        {editingUser?.id === user.id ? (
                          <Select
                            value={editingUser.role}
                            onValueChange={(value: 'admin' | 'verifier' | 'basic') =>
                              setEditingUser({ ...editingUser, role: value })
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="verifier">Verifier</SelectItem>
                              <SelectItem value="basic">Basic</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'verifier' ? 'secondary' : 'outline'}>
                            {user.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUser?.id === user.id ? (
                          <Switch
                            checked={editingUser.is_active}
                            onCheckedChange={(checked) =>
                              setEditingUser({ ...editingUser, is_active: checked })
                            }
                          />
                        ) : (
                          <Badge variant={user.is_active ? 'default' : 'destructive'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.last_login_at)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {editingUser?.id === user.id ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={saving}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={saving}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicationUsers;