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
import { ArrowLeft, Users, Edit, Save, X, Search, Plus, UserPlus, AlertCircle, Building2, Trash2, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { BeautifulLoader } from '@/app/loader';
import { fetchOrganizationUsers, updateUser, searchAzureUsers, createDatabaseUser, deleteUser } from '@/services/userService';
import { organizationService } from '@/services/organizationService';
import { getSubscriptionStatus, getOrganizationUserCount } from '@/services/subscriptionService';
import { calculateSeatInfo, handleAddUser as seatManagerAddUser, formatSeatInfo, getSeatStatus } from '@/utils/seatManager';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/userAuthConfig';
import { useTokenValidation } from '@/hooks/useTokenValidation';
import { tokenInterceptor } from '@/utils/tokenInterceptor';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const { user, isAuthenticated, isLoading, refreshUser } = useAuth();
  const { instance, accounts } = useMsal();
  const { toast } = useToast();
  const { isTokenValid, validateTokens, isValidating } = useTokenValidation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Organization editing states
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  // Azure user search states
  const [searchQuery, setSearchQuery] = useState('');
  const [azureUsers, setAzureUsers] = useState<AzureUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'verifier' | 'basic'>('basic');
  const [creatingUser, setCreatingUser] = useState(false);
  const [authError, setAuthError] = useState(false);

    // Upgrade confirmation dialog state
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [pendingUser, setPendingUser] = useState<AzureUser | null>(null);
  const [upgradeInfo, setUpgradeInfo] = useState<any>(null);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscription and seat management states
  const [subscription, setSubscription] = useState<any>(null);
  const [seatInfo, setSeatInfo] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [billingUserCount, setBillingUserCount] = useState(0); // Only admin + verifier users

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAuthenticated && user) {
      // Fetch both subscription and users, then calculate seats
      const loadData = async () => {
        await Promise.all([
          fetchUsers(),
          fetchSubscriptionInfo(),
          fetchBillingUserCount()
        ]);
      };
      
      loadData();
      
      if (user.organizations) {
        setOrgName(user.organizations.display_name);
      }
    }
  }, [isAuthenticated, user]);

  // Recalculate seat info whenever subscription or billing user count changes
  useEffect(() => {
    if (subscription && billingUserCount >= 0) {
      const newSeatInfo = calculateSeatInfo(subscription, billingUserCount);
      console.log('Seat info calculated:', {
        subscription: subscription,
        billingUserCount,
        newSeatInfo
      });
      setSeatInfo(newSeatInfo);
    }
  }, [subscription, billingUserCount]);

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

  // Handle Stripe checkout success/cancel URL parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const upgradeStatus = urlParams.get('upgrade');
    const sessionId = urlParams.get('session_id');
    
    if (upgradeStatus === 'success') {
      toast({
        title: 'Payment Successful!',
        description: 'Your subscription has been upgraded and the user has been added successfully.',
      });
      
      // Refresh data to show updated subscription and users
      setTimeout(() => {
        Promise.all([
          fetchUsers(),
          fetchSubscriptionInfo(),
          fetchBillingUserCount()
        ]);
      }, 1000);
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (upgradeStatus === 'cancelled') {
      toast({
        title: 'Payment Cancelled',
        description: 'The subscription upgrade was cancelled. No charges were made.',
        variant: 'destructive',
      });
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      if (!user?.organization_id) {
        throw new Error('No organization found');
      }

      const users = await fetchOrganizationUsers(user.organization_id);
      setUsers(users);
      
      // Seat info will be recalculated by the useEffect hook
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

  const fetchSubscriptionInfo = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingSubscription(true);
      const subscriptionData = await getSubscriptionStatus(user.id);
      setSubscription(subscriptionData.subscription);
      
      // Seat info will be recalculated by the useEffect hook
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const fetchBillingUserCount = async () => {
    if (!user?.organization_id) return;
    
    try {
      const countData = await getOrganizationUserCount(user.organization_id);
      console.log('Billing user count fetched:', countData);
      setBillingUserCount(countData.userCount); // Only admin + verifier users
    } catch (error) {
      console.error('Error fetching billing user count:', error);
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

  const handleSaveOrganization = async () => {
    if (!user || !user.organization_id || !orgName.trim()) {
      toast({
        title: 'Error',
        description: 'Organization name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setSavingOrg(true);
    try {
      const result = await organizationService.updateOrganization({
        organizationId: user.organization_id,
        organizationName: orgName,
        userEmail: user.email,
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Organization name updated successfully',
        });
        setIsEditingOrg(false);
        // Refresh user context to get updated organization name
        await refreshUser();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setSavingOrg(false);
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
      
      // Validate tokens before making the search
      const tokensValid = await validateTokens();
      if (!tokensValid) {
        setAuthError(true);
        toast({
          title: 'Authentication Required',
          description: 'Your session has expired. Please refresh the page.',
          variant: 'destructive',
        });
        return;
      }
      
      const results = await searchAzureUsers(instance, accounts, query);
      setAzureUsers(results);
    } catch (error: any) {
      console.error('Error searching Azure users:', error);
      
      // Let the tokenInterceptor handle authentication errors globally
      tokenInterceptor.handleGraphApiError(error, 'searchAzureUsers');
      
      // Check for specific error types that we should handle locally
      if (error.message === 'INTERACTION_REQUIRED') {
        setAuthError(true);
        toast({
          title: 'Authentication Required',
          description: 'Your session has expired. Please re-authenticate to search users.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('AUTHENTICATION')) {
        // Authentication errors will be handled by tokenInterceptor (redirect)
        setAuthError(true);
      } else {
        // Other errors (permissions, network, etc.)
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

    // Check if this is a billable user (admin/verifier)
    if (selectedRole === 'admin' || selectedRole === 'verifier') {
      // Check if subscription is canceled AND has expired
      if (subscription && subscription.status === 'canceled') {
        // Check if the subscription has actually expired
        const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
        const now = new Date();
        
        if (!currentPeriodEnd || now > currentPeriodEnd) {
          // Subscription has truly expired
          toast({
            title: 'Subscription Expired',
            description: 'Your subscription has expired. Please reactivate your subscription to add admin/verifier users.',
            variant: 'destructive',
          });
          return;
        }
        // If subscription is canceled but still within active period, allow user creation
        console.log('🟡 Subscription is canceled but still active until:', currentPeriodEnd.toLocaleDateString());
      }
      
      // Check if we need to show upgrade confirmation modal first
      if (subscription && seatInfo) {
        console.log('Seat check:', {
          availableSeats: seatInfo.availableSeats,
          billingUserCount,
          subscribedSeats: subscription.user_count,
          seatInfo
        });
        
        if (seatInfo.availableSeats <= 0) {
          // Close the add user dialog and show upgrade confirmation dialog
          setShowAddUserDialog(false);
          
          // Show upgrade confirmation dialog
          const newUserCount = billingUserCount + 1;
          const pricePerUser = 9; // $9 per user
          const newMonthlyTotal = newUserCount * pricePerUser;
          const currentMonthlyTotal = subscription.user_count * pricePerUser;
          
          setUpgradeInfo({
            currentSeats: subscription.user_count,
            newSeats: newUserCount,
            currentMonthlyTotal,
            newMonthlyTotal,
            additionalCost: newMonthlyTotal - currentMonthlyTotal
          });
          setPendingUser(azureUser);
          setShowUpgradeDialog(true);
          return;
        }
      }
    }

    // Proceed with user creation (either basic user or we have available seats)
    await createUserDirectly(azureUser);
  };

  const createUserDirectly = async (azureUser: AzureUser) => {
    if (!user?.organization_id || !user?.tenant_id || !user?.client_id) return;

    try {
      setCreatingUser(true);
      
      // Check seat availability for admin/verifier users and handle automatic upgrades
      if (subscription && seatInfo && (selectedRole === 'admin' || selectedRole === 'verifier')) {
        console.log('🔄 Checking seat availability and handling upgrades...');
        
        const seatResult = await seatManagerAddUser(
          user.organization_id,
          subscription,
          billingUserCount
        );
        
        if (!seatResult.canAdd) {
          toast({
            title: 'Cannot Add User',
            description: seatResult.message,
            variant: 'destructive',
          });
          return;
        }
        
        // Show upgrade success message if subscription was upgraded
        if (seatResult.needsUpgrade && seatResult.prorationDetails) {
          toast({
            title: 'Subscription Upgraded',
            description: `Upgraded to ${seatResult.newSeatCount} seats. ${seatResult.message}`,
          });
        }
      }
      
      console.log('🔄 Creating user in database...');
      
      // Create the user in database
      const newUser = await createDatabaseUser(
        azureUser,
        selectedRole,
        user.organization_id,
        user.tenant_id,
        user.client_id
      );

      console.log('✅ User created successfully');

      // Add to local state
      setUsers([newUser, ...users]);
      
      // Refresh billing user count and subscription info
      await Promise.all([
        fetchBillingUserCount(),
        fetchSubscriptionInfo()
      ]);
      
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
      console.error('❌ Error in user creation process:', error);
      
      // More specific error messages
      if (error.message?.includes('subscription')) {
        toast({
          title: 'Subscription Upgrade Failed',
          description: 'Your subscription could not be upgraded. Please check your payment method and try again.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('payment') || error.message?.includes('card')) {
        toast({
          title: 'Payment Failed',
          description: 'Payment could not be processed. Please update your payment method and try again.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('user') || error.message?.includes('database')) {
        toast({
          title: 'User Creation Failed',
          description: 'The subscription was updated but user creation failed. Please contact support.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
      }
      
      // Refresh data to sync any partial changes
      await Promise.all([
        fetchBillingUserCount(),
        fetchSubscriptionInfo()
      ]);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpgradeConfirm = async () => {
    if (!pendingUser || !upgradeInfo || !user?.organization_id || !user?.tenant_id || !user?.client_id) return;
    
    try {
      setCreatingUser(true);
      setShowUpgradeDialog(false);
      
      console.log('🔄 Confirming upgrade and creating user...');
      
      // Use automatic seat manager to upgrade subscription
      const seatResult = await seatManagerAddUser(
        user.organization_id,
        subscription!,
        billingUserCount
      );
      
      if (!seatResult.canAdd) {
        toast({
          title: 'Cannot Add User',
          description: seatResult.message,
          variant: 'destructive',
        });
        return;
      }
      
      // Show upgrade success message if subscription was upgraded
      if (seatResult.needsUpgrade && seatResult.prorationDetails) {
        toast({
          title: 'Subscription Upgraded',
          description: `Upgraded to ${seatResult.newSeatCount} seats. ${seatResult.message}`,
        });
      }
      
      console.log('🔄 Creating user in database...');
      
      // Create the user in database
      const newUser = await createDatabaseUser(
        pendingUser,
        selectedRole,
        user.organization_id,
        user.tenant_id,
        user.client_id
      );

      console.log('✅ User created successfully');

      // Add to local state
      setUsers([newUser, ...users]);
      
      // Refresh billing user count and subscription info
      await Promise.all([
        fetchBillingUserCount(),
        fetchSubscriptionInfo()
      ]);
      
      // Reset dialog state
      setSearchQuery('');
      setAzureUsers([]);
      setSelectedRole('basic');
      setAuthError(false);

      toast({
        title: 'Success',
        description: `User ${pendingUser.displayName} created successfully`,
      });
      
    } catch (error: any) {
      console.error('❌ Error in upgrade and user creation process:', error);
      
      // More specific error messages
      if (error.message?.includes('subscription')) {
        toast({
          title: 'Subscription Upgrade Failed',
          description: 'Your subscription could not be upgraded. Please check your payment method and try again.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('payment') || error.message?.includes('card')) {
        toast({
          title: 'Payment Failed',
          description: 'Payment could not be processed. Please update your payment method and try again.',
          variant: 'destructive',
        });
      } else if (error.message?.includes('user') || error.message?.includes('database')) {
        toast({
          title: 'User Creation Failed',
          description: 'The subscription was updated but user creation failed. Please contact support.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
      }
      
      // Refresh data to sync any partial changes
      await Promise.all([
        fetchBillingUserCount(),
        fetchSubscriptionInfo()
      ]);
      
      // Reopen add user dialog on error
      setShowAddUserDialog(true);
    } finally {
      setCreatingUser(false);
      // Clean up dialog state
      setPendingUser(null);
      setUpgradeInfo(null);
    }
  };

  const handleUpgradeCancel = () => {
    setShowUpgradeDialog(false);
    setPendingUser(null);
    setUpgradeInfo(null);
    
    // Reopen the add user dialog so user can try again or cancel
    setShowAddUserDialog(true);
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearchAzureUsers(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Helper function to check if subscription is truly expired (not just canceled)
  const isSubscriptionExpired = (subscription: any): boolean => {
    if (!subscription) return true;
    
    // Case 1: Cancel immediately - status is "canceled" and no period end date
    if (subscription.status === 'canceled' && !subscription.current_period_end) {
      return true; // Access blocked immediately
    }
    
    // Case 2: Cancel at period end - status is "active" but cancel_at_period_end is true
    if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      return false; // Still has access until period end
    }
    
    // Case 3: Cancel at period end - status is "canceled" but period end date exists
    if (subscription.status === 'canceled' && subscription.current_period_end) {
      const currentPeriodEnd = new Date(subscription.current_period_end);
      const now = new Date();
      return now > currentPeriodEnd; // Check if period has actually ended
    }
    
    // Case 4: Active subscription
    if (subscription.status === 'active') {
      return false; // Active subscriptions are not expired
    }
    
    // Case 5: Other statuses (past_due, unpaid, etc.)
    return subscription.status !== 'active';
  };

  // Helper function to capitalize role text
  const capitalizeRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !user) return;

    setIsDeleting(true);
    try {
      const result = await deleteUser(userToDelete.id, user.email);
      if (result.success) {
        const newUsers = users.filter(u => u.id !== userToDelete.id);
        setUsers(newUsers);
        
        // Update billing user count after user removal
        if (subscription && user?.organization_id) {
          // Refresh billing user count since we removed a user
          await fetchBillingUserCount();
          
          toast({
            title: 'Success',
            description: 'User deleted successfully.',
          });
        } else {
          toast({
            title: 'Success',
            description: 'User deleted successfully',
          });
        }
        
        setUserToDelete(null);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
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
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container py-12">
        <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin-portal">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Portal
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/subscription">
              <Button variant="outline" size="sm">
                <CreditCard className="h-4 w-4 mr-2" />
                Subscription
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Application Users
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-foreground">
          <Building2 className="h-4 w-4" />
          {isEditingOrg ? (
            <div className="flex items-center gap-2">
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="h-8"
                disabled={savingOrg}
              />
              <Button size="sm" onClick={handleSaveOrganization} disabled={savingOrg}>
                {savingOrg ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setIsEditingOrg(false); setOrgName(user?.organizations?.display_name || ''); }} disabled={savingOrg}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{user?.organizations?.display_name || 'Organization'}</span>
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsEditingOrg(true)}>
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seat Information Card */}
      {isAdmin && seatInfo && subscription && !isSubscriptionExpired(subscription) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{seatInfo.subscribedSeats}</div>
                <div className="text-sm text-muted-foreground">Subscribed Seats</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{seatInfo.activeUsers}</div>
                <div className="text-sm text-muted-foreground">Billable Users</div>
                <div className="text-xs text-muted-foreground">(Admin + Verifier)</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${seatInfo.availableSeats > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  {seatInfo.availableSeats}
                </div>
                <div className="text-sm text-muted-foreground">Available Seats</div>
              </div>
              <div className="text-center">
                <Badge variant={getSeatStatus(seatInfo) === 'available' ? 'secondary' : getSeatStatus(seatInfo) === 'full' ? 'destructive' : 'outline'}>
                  {getSeatStatus(seatInfo) === 'available' ? 'Can Add Users' : 
                   getSeatStatus(seatInfo) === 'full' ? 'At Seat Limit' : 'Over Limit'}
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">{formatSeatInfo(seatInfo)}</div>
              </div>
            </div>
            {seatInfo.availableSeats > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  💡 You can add {seatInfo.availableSeats} more admin/verifier user{seatInfo.availableSeats === 1 ? '' : 's'} without additional charge.
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Basic users are always free and don't count towards your subscription.
                </p>
              </div>
            )}
            {seatInfo.availableSeats === 0 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <p className="text-sm text-orange-800">
                  ⚠️ At seat limit. Adding more admin/verifier users will upgrade your subscription and charge prorated amount.
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Basic users are always free and don't count towards your subscription.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Canceled/Canceling Subscription Warning */}
      {isAdmin && subscription && (subscription.status === 'canceled' || subscription.cancel_at_period_end) && (
        <Card className={`mb-6 ${isSubscriptionExpired(subscription) ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isSubscriptionExpired(subscription) ? 'text-red-800' : 'text-orange-800'}`}>
              <CreditCard className="h-5 w-5" />
              {isSubscriptionExpired(subscription) ? 'Subscription Expired' : 'Subscription Canceled'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isSubscriptionExpired(subscription) ? (
                <>
                  <p className="text-red-700">
                    Your subscription has expired. Please reactivate your subscription to continue adding admin/verifier users.
                  </p>
                  <div className="bg-red-100 p-3 rounded-md">
                    <p className="text-sm text-red-800">
                      {subscription.current_period_end ? (
                        <><strong>Expired on:</strong> {new Date(subscription.current_period_end).toLocaleDateString()}</>
                      ) : (
                        <><strong>Status:</strong> Subscription was canceled and terminated.</>
                      )}
                    </p>
                  </div>
                </>
              ) : subscription.cancel_at_period_end && subscription.status === 'active' ? (
                <>
                  <p className="text-orange-700">
                    Your subscription is scheduled to cancel at the end of your billing period. You can continue adding users normally until then.
                  </p>
                  <div className="bg-orange-100 p-3 rounded-md">
                    <p className="text-sm text-orange-800">
                      <strong>Access expires:</strong> {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'Unknown'}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      After this date, you'll need to reactivate your subscription to continue adding admin/verifier users.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-orange-700">
                    Your subscription has been canceled but is still active until the end of your billing period. You can continue adding users normally.
                  </p>
                  <div className="bg-orange-100 p-3 rounded-md">
                    <p className="text-sm text-orange-800">
                      <strong>Access expires:</strong> {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'Unknown'}
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      After this date, you'll need to reactivate your subscription to continue adding admin/verifier users.
                    </p>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Link href="/subscription">
                  <Button variant="default" size="sm">
                    Reactivate Subscription
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Button className="relative">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                    {isSubscriptionExpired(subscription) ? (
                      <Badge variant="destructive" className="ml-2 h-5 text-xs">
                        subscription required
                      </Badge>
                    ) : seatInfo && (
                      <Badge 
                        variant={seatInfo.availableSeats > 0 ? "secondary" : "destructive"} 
                        className="ml-2 h-5 text-xs"
                      >
                        {seatInfo.availableSeats > 0 
                          ? `${seatInfo.availableSeats} free seats` 
                          : 'upgrade needed'
                        }
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Search for Azure AD users and add them to your organization
                    </DialogDescription>
                    {isSubscriptionExpired(subscription) ? (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="text-sm text-red-800">
                          ⚠️ Your subscription has expired. You can only add basic users.
                        </div>
                        <div className="text-xs text-red-700 mt-1">
                          Reactivate your subscription to add admin/verifier users.
                        </div>
                      </div>
                    ) : subscription?.cancel_at_period_end && subscription.status === 'active' ? (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="text-sm text-orange-800">
                          🟡 Your subscription is scheduled to cancel on {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'end of period'}.
                        </div>
                        <div className="text-xs text-orange-700 mt-1">
                          You can continue adding users normally until the cancellation date.
                        </div>
                      </div>
                    ) : subscription?.status === 'canceled' && subscription?.current_period_end ? (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="text-sm text-orange-800">
                          🟡 Your subscription is canceled but still active until {new Date(subscription.current_period_end).toLocaleDateString()}.
                        </div>
                        <div className="text-xs text-orange-700 mt-1">
                          You can continue adding users normally until the expiration date.
                        </div>
                      </div>
                    ) : seatInfo && (
                      <div className="mt-2 text-sm space-y-1">
                        <div>
                          {seatInfo.availableSeats > 0 ? (
                            <span className="text-green-600">
                              ✅ {seatInfo.availableSeats} seat{seatInfo.availableSeats === 1 ? '' : 's'} available for admin/verifier users
                            </span>
                          ) : (
                            <span className="text-orange-600">
                              ⚠️ At seat limit - adding admin/verifier users will upgrade subscription
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          💡 Basic users are always free and don't require seats
                        </div>
                      </div>
                    )}
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
                    {/* <TableHead>Tenant ID</TableHead> */}
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    {isAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      {/* <TableCell className="font-mono text-sm">{u.tenant_id}</TableCell> */}
                      <TableCell>{u.organizations?.display_name || 'N/A'}</TableCell>
                      <TableCell>
                        {editingUser?.id === u.id ? (
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
                          <Badge variant={u.role === 'admin' ? 'default' : u.role === 'verifier' ? 'secondary' : 'outline'}>
                            {capitalizeRole(u.role)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUser?.id === u.id ? (
                          <Switch
                            checked={editingUser.is_active}
                            onCheckedChange={(checked) =>
                              setEditingUser({ ...editingUser, is_active: checked })
                            }
                          />
                        ) : (
                          <Badge variant={u.is_active ? 'default' : 'destructive'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(u.last_login_at)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          {editingUser?.id === u.id ? (
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
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(u)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Dialog open={!!userToDelete && userToDelete.id === u.id} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="destructive" onClick={() => setUserToDelete(u)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Are you sure?</DialogTitle>
                                    <DialogDescription>
                                      This action will permanently delete the user <span className="font-bold">{userToDelete?.email}</span>. This cannot be undone.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
                                      {isDeleting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 'Delete'}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
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

      {/* Upgrade Confirmation Dialog */}
      <AlertDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Subscription Upgrade Required</AlertDialogTitle>
            <AlertDialogDescription>
              Adding this {selectedRole} user will exceed your current seat limit. Your subscription will be automatically upgraded.
            </AlertDialogDescription>
            {upgradeInfo && (
              <div className="bg-muted p-4 rounded-lg space-y-2 mt-3">
                <div className="flex justify-between">
                  <span>Current seats:</span>
                  <span>{upgradeInfo.currentSeats}</span>
                </div>
                <div className="flex justify-between">
                  <span>New seats:</span>
                  <span>{upgradeInfo.newSeats}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current monthly cost:</span>
                  <span>${upgradeInfo.currentMonthlyTotal}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>New monthly cost:</span>
                  <span>${upgradeInfo.newMonthlyTotal}</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>Additional cost:</span>
                  <span>+${upgradeInfo.additionalCost}/month</span>
                </div>
              </div>
            )}
            {upgradeInfo && (
              <div className="text-sm text-muted-foreground mt-3">
                You will be charged a prorated amount for the remainder of your current billing period.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleUpgradeCancel}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUpgradeConfirm}
              disabled={creatingUser}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creatingUser ? 'Upgrading...' : 'Upgrade & Add User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </main>
      <Footer />
    </div>
  );
};

export default ApplicationUsers;