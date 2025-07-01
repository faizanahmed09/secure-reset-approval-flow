'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  Crown,
  Zap,
  Building2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  getSubscriptionStatus, 
  redirectToCustomerPortal,
  getOrganizationUserCount,
  SubscriptionStatus 
} from '@/services/subscriptionService';

interface SubscriptionStatusProps {
  userId?: string;
  showManagement?: boolean;
}

const SubscriptionStatusComponent = ({ 
  userId, 
  showManagement = true 
}: SubscriptionStatusProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectingToPortal, setRedirectingToPortal] = useState(false);
  const [userCount, setUserCount] = useState<number>(1);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchSubscriptionStatus();
    }
  }, [targetUserId]);

  const fetchSubscriptionStatus = async () => {
    if (!targetUserId) return;

    try {
      const status = await getSubscriptionStatus(targetUserId);
      setSubscriptionStatus(status);
      
      // Fetch user count for pricing display
      if (user?.organization_id && status.hasActiveSubscription) {
        try {
          const countData = await getOrganizationUserCount(user.organization_id);
          setUserCount(countData.userCount);
        } catch (error) {
          console.error('Error fetching user count:', error);
        }
      }
    } catch (error: any) {
      console.error('Error fetching subscription status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!targetUserId) return;

    setRedirectingToPortal(true);

    try {
      await redirectToCustomerPortal({
        userId: targetUserId,
        returnUrl: `${window.location.origin}/subscription`,
      });
    } catch (error: any) {
      console.error('Error redirecting to customer portal:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to access customer portal',
        variant: 'destructive',
      });
      setRedirectingToPortal(false);
    }
  };

  const getPlanIcon = (planName: string) => {
    if (planName.toLowerCase().includes('basic')) return <Zap className="h-5 w-5" />;
    if (planName.toLowerCase().includes('pro')) return <Crown className="h-5 w-5" />;
    if (planName.toLowerCase().includes('enterprise')) return <Building2 className="h-5 w-5" />;
    return <Zap className="h-5 w-5" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500"><Calendar className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-orange-500"><AlertTriangle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-red-500">Canceled</Badge>;
      case 'unpaid':
        return <Badge className="bg-red-500"><AlertTriangle className="h-3 w-3 mr-1" />Unpaid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionStatus?.hasActiveSubscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>
            No active subscription found for this user.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { subscription } = subscriptionStatus;
  console.log('Subscription Status:', subscriptionStatus);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-blue-600">
              {getPlanIcon(subscription?.plan?.name || '')}
            </div>
            <div>
              <CardTitle className="text-lg">{subscription?.plan?.name}</CardTitle>
              <CardDescription>{subscription?.plan?.description}</CardDescription>
            </div>
          </div>
          {getStatusBadge(subscription?.status || '')}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Billing Amount</span>
            </div>
            <p className="text-xl font-bold text-blue-600">
              {subscription?.is_trial ? 'Free Trial' : `$${(parseFloat(subscription?.plan?.formatted_price?.replace('$', '') || '0').toFixed(2))}`}
              {/* {subscription?.is_trial ? 'Free Trial' : `$${(parseFloat(subscription?.plan?.formatted_price?.replace('$', '') || '0') * (userCount || 1)).toFixed(2)}`} */}

              <span className="text-sm text-gray-600 ml-1">
                {subscription?.is_trial ? '' : `for ${subscription?.user_count} user${userCount !== 1 ? 's' : ''}`}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Next Billing</span>
            </div>
            <p className="text-lg">
              {subscription?.is_trial 
                ? `${formatDate(subscription?.trial_end_date || '')}`
                : `${formatDate(subscription?.current_period_end || '')}`}
            </p>
            {subscription?.days_until_renewal !== undefined && (
              <p className="text-sm text-gray-600">
                ({subscription.is_trial ? subscription?.trial_days_remaining : subscription.days_until_renewal} days until renewal)
              </p>
            )}
          </div>
        </div>

        {subscription?.cancel_at_period_end && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Subscription will cancel on {formatDate(subscription.current_period_end || '')}.
            </AlertDescription>
          </Alert>
        )}

        {showManagement && (
          <Button 
            onClick={handleManageSubscription}
            disabled={redirectingToPortal}
            className="w-full flex items-center justify-center gap-2"
            variant="outline"
          >
            {redirectingToPortal ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                Loading...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Manage Subscription
                <ExternalLink className="h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionStatusComponent; 