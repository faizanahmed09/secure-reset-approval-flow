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
  SubscriptionStatus 
} from '@/services/subscriptionService';
import { BeautifulLoader } from '@/app/loader';

const SubscriptionManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectingToPortal, setRedirectingToPortal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
    }
  }, [user]);

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) return;

    try {
      const status = await getSubscriptionStatus(user.id);
      setSubscriptionStatus(status);
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
    if (!user?.id) return;

    setRedirectingToPortal(true);

    try {
      await redirectToCustomerPortal({
        userId: user.id,
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

  const formatFeature = (key: string, value: any) => {
    if (key === 'mfa_resets') {
      return value === -1 ? 'Unlimited MFA resets' : `${value} MFA resets per month`;
    }
    if (typeof value === 'boolean' && value) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  if (!subscriptionStatus?.hasActiveSubscription) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>
              You don't have an active subscription. Choose a plan to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/subscription/plans'}
              className="w-full"
            >
              View Subscription Plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription } = subscriptionStatus;
  console.log('Subscription Data:', subscription);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Management</h1>
          <p className="text-gray-600">Manage your subscription and billing</p>
        </div>
        <Button 
          onClick={handleManageSubscription}
          disabled={redirectingToPortal}
          className="flex items-center gap-2"
        >
          {redirectingToPortal ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Loading...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4" />
              Manage Billing
              <ExternalLink className="h-3 w-3" />
            </>
          )}
        </Button>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-blue-600">
                {getPlanIcon(subscription?.plan?.name || '')}
              </div>
              <div>
                <CardTitle className="text-xl">{subscription?.plan?.name}</CardTitle>
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
              <p className="text-2xl font-bold text-blue-600">
                {subscription?.plan?.formatted_price}
                <span className="text-sm text-gray-600 ml-1">
                  per {subscription?.plan?.interval}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Next Billing Date</span>
              </div>
              <p className="text-lg">
                {formatDate(subscription?.current_period_end || '')}
              </p>
              {subscription?.days_until_renewal !== undefined && (
                <p className="text-sm text-gray-600">
                  ({subscription.days_until_renewal} days remaining)
                </p>
              )}
            </div>
          </div>

          {subscription?.cancel_at_period_end && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your subscription is set to cancel at the end of the current billing period on{' '}
                {formatDate(subscription?.current_period_end || '')}.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Plan Features Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Plan Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {subscription?.plan?.max_users && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Up to {subscription.plan.max_users} users</span>
              </div>
            )}
            {subscription?.plan?.max_users === null && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Unlimited users</span>
              </div>
            )}
            
            {subscription?.plan?.features && 
              Object.entries(subscription.plan.features).map(([key, value]) => {
                const featureText = formatFeature(key, value);
                if (!featureText) return null;
                
                return (
                  <div key={key} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{featureText}</span>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Billing History & Management */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Management</CardTitle>
          <CardDescription>
            Access your billing history, download invoices, and update payment methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleManageSubscription}
            disabled={redirectingToPortal}
            className="w-full flex items-center justify-center gap-2"
          >
            {redirectingToPortal ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Redirecting to Stripe...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Open Billing Portal
                <ExternalLink className="h-3 w-3" />
              </>
            )}
          </Button>
          <p className="text-sm text-gray-600 text-center mt-2">
            Powered by Stripe • Secure billing management
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManagement; 