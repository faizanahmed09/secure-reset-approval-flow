'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  redirectToCheckout, 
  STARTER_PLAN,
  getOrganizationUserCount
} from '@/services/subscriptionService';

const SubscriptionPlans = ({ subscriptionStatus, plans }: { subscriptionStatus?: any; plans: any[] }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribingToPlan, setSubscribingToPlan] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(1);
  const [pricing, setPricing] = useState<any>(null);
  const [loadingCount, setLoadingCount] = useState(true);

  // Use hardcoded plan instead of props since we only have one tier
  const plan = STARTER_PLAN;

  useEffect(() => {
    const fetchUserCount = async () => {
      if (user?.organization_id) {
        setLoadingCount(true);
        try {
          const countData = await getOrganizationUserCount(user.organization_id);
          setUserCount(countData.userCount);
          setPricing(countData.pricing);
        } catch (error) {
          console.error('Error fetching user count:', error);
          toast({
            title: 'Warning',
            description: 'Could not fetch user count. Using default pricing.',
            variant: 'destructive',
          });
          // Fallback to single user pricing
          setUserCount(1);
          setPricing({
            basePrice: 9,
            totalAmount: 900,
            formattedPrice: '$9',
            breakdown: '1 user × $9 = $9'
          });
        } finally {
          setLoadingCount(false);
        }
      }
    };

    fetchUserCount();
  }, [user?.organization_id, toast]);

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to subscribe to a plan',
        variant: 'destructive',
      });
      return;
    }

    if (userCount === 0) {
      toast({
        title: 'No Users Found',
        description: 'Your organization needs at least one admin or verifier user to subscribe',
        variant: 'destructive',
      });
      return;
    }

    setSubscribingToPlan(plan.id);

    try {
      await redirectToCheckout({
        priceId: plan.stripe_price_id,
        userEmail: user.email,
        userId: user.id,
        organizationId: user.organization_id,
        quantity: userCount,
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription`,
      });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Failed to start subscription process',
        variant: 'destructive',
      });
      setSubscribingToPlan(null);
    }
  };

  const isCurrentPlan = () => {
    return subscriptionStatus?.hasActiveSubscription && 
           subscriptionStatus?.subscription?.plan_name === 'STARTER' &&
           subscriptionStatus?.subscription?.status !== 'canceled';
  };

  const isRestrictedPlan = () => {
    return subscriptionStatus?.subscription?.plan_name === 'RESTRICTED';
  };

  const getButtonText = () => {
    if (subscribingToPlan === plan.id) {
      return (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Processing...
        </>
      );
    }
    
    if (isCurrentPlan()) {
      return 'Current Plan';
    }
    
    if (isRestrictedPlan()) {
      return 'Renew Subscription';
    }
    
    return 'Subscribe Now';
  };

  const isButtonDisabled = () => {
    return subscribingToPlan === plan.id || isCurrentPlan() || userCount === 0;
  };

  const formatFeature = (key: string, value: any) => {
    if (key === 'push_verifications') {
      return value === 'unlimited' ? 'Unlimited Microsoft Authenticator push verifications' : `${value} push verifications`;
    }
    if (key === 'log_retention') {
      return `${value} log retention`;
    }
    if (key === 'sso' && value) {
      return 'Single sign-on with Microsoft 365';
    }
    return null;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">
          {subscriptionStatus?.hasActiveSubscription ? 'Manage Your Plan' : 'Choose Your Plan'}
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Get unlimited Microsoft Authenticator push verifications with our simple per-user pricing.
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="w-full max-w-md relative border-blue-500 shadow-lg">
          <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
            Most Popular
          </Badge>
          
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 text-blue-600">
              <Zap className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
            
            {loadingCount ? (
              <div className="mt-4">
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-24 mx-auto"></div>
                  <div className="h-4 bg-gray-200 rounded w-32 mx-auto mt-2"></div>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <span className="text-3xl font-bold">{plan.formatted_price}</span>
                {/* <span className="text-3xl font-bold">{pricing?.formattedPrice || '$9'}</span> */}
                <span className="text-gray-600 ml-1">per month</span>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {pricing?.breakdown || `${userCount} user${userCount !== 1 ? 's' : ''} × $9`}
                  </span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <div className="space-y-3 mb-6">
              {Object.entries(plan.features).map(([key, value]) => {
                const featureText = formatFeature(key, value);
                if (!featureText) return null;
                
                return (
                  <div key={key} className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    <span>{featureText}</span>
                  </div>
                );
              })}
              
              <div className="flex items-center">
                <Check className="h-4 w-4 text-green-500 mr-2" />
                <span>Covers all {userCount} admin & verifier users</span>
              </div>
            </div>

            {userCount === 0 && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <p className="text-sm text-orange-800">
                  Your organization needs at least one admin or verifier user to subscribe.
                </p>
              </div>
            )}

            <Button 
              className="w-full" 
              onClick={handleSubscribe}
              disabled={isButtonDisabled()}
              variant={isCurrentPlan() ? "outline" : "default"}
            >
              {getButtonText()}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-8">
        <p className="text-gray-600">
          Need help? <a href="mailto:support@authenpush.com" className="text-blue-600 hover:underline">Contact us</a>
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlans;