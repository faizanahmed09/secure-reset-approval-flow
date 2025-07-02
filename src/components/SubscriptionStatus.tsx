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
  Building2,
  Sparkles,
  Shield,
  Timer,
  DollarSign
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
    if (planName.toLowerCase().includes('basic')) return <Zap className="h-6 w-6" />;
    if (planName.toLowerCase().includes('pro')) return <Crown className="h-6 w-6" />;
    if (planName.toLowerCase().includes('enterprise')) return <Building2 className="h-6 w-6" />;
    return <Zap className="h-6 w-6" />;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium shadow-lg";
    
    switch (status) {
      case 'active':
        return (
          <Badge className={`${baseClasses} bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0`}>
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        );
      case 'trialing':
        return (
          <Badge className={`${baseClasses} bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0`}>
            <Timer className="h-3 w-3" />
            Trial
          </Badge>
        );
      case 'past_due':
        return (
          <Badge className={`${baseClasses} bg-gradient-to-r from-orange-500 to-red-500 text-white border-0`}>
            <AlertTriangle className="h-3 w-3" />
            Past Due
          </Badge>
        );
      case 'canceled':
        return (
          <Badge className={`${baseClasses} bg-gradient-to-r from-gray-500 to-gray-600 text-white border-0`}>
            Canceled
          </Badge>
        );
      case 'unpaid':
        return (
          <Badge className={`${baseClasses} bg-gradient-to-r from-red-600 to-pink-600 text-white border-0`}>
            <AlertTriangle className="h-3 w-3" />
            Unpaid
          </Badge>
        );
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
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/30 rounded-full blur-3xl"></div>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-blue-200 rounded-xl"></div>
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-blue-200 rounded-lg w-1/3"></div>
                <div className="h-4 bg-blue-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="h-20 bg-blue-200 rounded-xl"></div>
              <div className="h-20 bg-blue-200 rounded-xl"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionStatus?.hasActiveSubscription) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-200/30 rounded-full blur-3xl"></div>
        <CardHeader className="relative">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-gray-400 to-gray-500 rounded-xl">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-gray-900">No Active Subscription</CardTitle>
              <CardDescription className="text-gray-600">
                No active subscription found for this user.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const { subscription } = subscriptionStatus;

  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-50 group hover:shadow-3xl transition-all duration-500">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-300/30 to-blue-400/30 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-blue-200/20 to-blue-300/20 rounded-full blur-2xl"></div>
      
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                <div className="text-white">
                  {getPlanIcon(subscription?.plan?.name || '')}
                </div>
              </div>
              <div className="absolute -top-1 -right-1">
                <div className="p-1 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {subscription?.plan?.name}
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">
                {subscription?.plan?.description}
              </CardDescription>
            </div>
          </div>
          <div className="transform group-hover:scale-105 transition-transform duration-300">
            {getStatusBadge(subscription?.status || '')}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 relative">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Billing Amount Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 group/card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-gray-700">Billing Amount</span>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                {subscription?.is_trial ? 'Free Trial' : `$${(parseFloat(subscription?.plan?.formatted_price?.replace('$', '') || '0').toFixed(2))}`}
              </p>
              {!subscription?.is_trial && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  for {subscription?.user_count} user{userCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          {/* Next Billing Card */}
          <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg hover:shadow-xl transition-all duration-300 group/card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-gray-700">
                {(subscription?.cancel_at_period_end || subscription?.cancel_at) ? 'Access Ends' : 'Next Billing'}
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-gray-900">
                {subscription?.is_trial 
                  ? `${formatDate(subscription?.trial_end_date || '')}`
                  : `${formatDate(subscription?.current_period_end || '')}`}
              </p>
              {subscription?.days_until_renewal !== undefined && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  {subscription.is_trial ? subscription?.trial_days_remaining : subscription.days_until_renewal} days remaining
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cancellation Alert */}
        {(subscription?.cancel_at_period_end || subscription?.cancel_at) && (
          <Alert className="flex items-center bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 shadow-lg px-4 py-3">
            <div className="p-1 bg-gradient-to-r from-orange-400 to-red-400 rounded-full mr-3 flex-shrink-0 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <AlertDescription className="text-orange-800 font-medium text-center w-full">
              Your subscription will end on the date shown above. You will retain access to all features until then, but your plan will not renew.
            </AlertDescription>
          </Alert>
        )}

        {/* Management Button */}
        {showManagement && (
          <div className="pt-4">
            <Button 
              onClick={handleManageSubscription}
              disabled={redirectingToPortal}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 group/btn"
            >
              {redirectingToPortal ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Loading...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-3 group-hover/btn:scale-110 transition-transform duration-300" />
                  Manage Subscription
                  <ExternalLink className="h-4 w-4 ml-3 group-hover/btn:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionStatusComponent;