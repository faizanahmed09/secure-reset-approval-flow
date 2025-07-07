'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Users, Crown, Sparkles, Shield, Timer, Star, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  redirectToCheckout, 
  BASIC_PLAN,
  getOrganizationUserCount
} from '@/services/subscriptionService';

const SubscriptionPlans = ({ subscriptionStatus, plans }: { subscriptionStatus?: any; plans: any[] }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscribingToPlan, setSubscribingToPlan] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(1);
  const [loadingCount, setLoadingCount] = useState(true);
  const [userCountFetched, setUserCountFetched] = useState<string | null>(null);

  // Use dynamic plans from props, fallback to hardcoded plan
  const availablePlans = plans.length > 0 ? plans : [BASIC_PLAN];

  // Stable error handler
  const showUserCountError = useCallback(() => {
    toast({
      title: 'Warning',
      description: 'Could not fetch user count. Using default.',
      variant: 'destructive',
    });
  }, [toast]);

  useEffect(() => {
    const fetchUserCount = async () => {
      if (user?.organization_id && userCountFetched !== user.organization_id) {
        setLoadingCount(true);
        try {
          const countData = await getOrganizationUserCount(user.organization_id);
          setUserCount(countData.userCount);
          setUserCountFetched(user.organization_id); // Mark as fetched for this org
        } catch (error) {
          console.error('Error fetching user count:', error);
          showUserCountError();
          // Fallback to single user
          setUserCount(1);
          setUserCountFetched(user.organization_id); // Mark as attempted even if failed
        } finally {
          setLoadingCount(false);
        }
      } else if (user?.organization_id && userCountFetched === user.organization_id) {
        // Already fetched for this org, just set loading to false
        setLoadingCount(false);
      }
    };

    fetchUserCount();
  }, [user?.organization_id, showUserCountError]); // Stable dependencies only

  const handleSubscribe = async (selectedPlan: any) => {
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

    setSubscribingToPlan(selectedPlan.id);

    try {
      await redirectToCheckout({
        priceId: selectedPlan.stripe_price_id,
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

  const isCurrentPlan = (selectedPlan: any) => {
    if (!subscriptionStatus?.hasActiveSubscription || !subscriptionStatus?.subscription) {
      return false;
    }
    
    const currentPlanName = subscriptionStatus.subscription.plan_name;
    const selectedPlanName = selectedPlan.name.toUpperCase();
    
    return currentPlanName === selectedPlanName && 
           subscriptionStatus.subscription.status !== 'canceled';
  };

  const isRestrictedPlan = () => {
    return subscriptionStatus?.subscription?.plan_name === 'RESTRICTED';
  };

  const getButtonText = (selectedPlan: any) => {
    if (subscribingToPlan === selectedPlan.id) {
      return (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
          Processing...
        </>
      );
    }
    
    if (isCurrentPlan(selectedPlan)) {
      return (
        <>
          <Crown className="h-5 w-5 mr-2" />
          Current Plan
        </>
      );
    }
    
    if (isRestrictedPlan()) {
      return (
        <>
          <TrendingUp className="h-5 w-5 mr-2" />
          Renew Subscription
        </>
      );
    }
    
    return (
      <>
        <Sparkles className="h-5 w-5 mr-2" />
        Subscribe Now
      </>
    );
  };

  const isButtonDisabled = (selectedPlan: any) => {
    return subscribingToPlan === selectedPlan.id || isCurrentPlan(selectedPlan) || userCount === 0;
  };

  const formatFeature = (key: string, value: any) => {
    if (key === 'push_verifications') {
      return value === 'unlimited' ? 'Unlimited Microsoft Authenticator push verifications' : `${value} push verifications`;
    }
    if (key === 'sms_verifications' && value) {
      return 'SMS Text code verifications';
    }
    if (key === 'teams_verification' && value) {
      return 'Microsoft Teams verification';
    }
    if (key === 'syslog_integration' && value) {
      return 'Send verification logs to Syslog';
    }
    if (key === 'log_retention') {
      return `${value} log retention`;
    }
    if (key === 'sso' && value) {
      return 'Microsoft Entra ID Single Sign-On';
    }
    return null;
  };

  return (
    <div className="bg-white">
      <div className="container mx-auto py-6">
        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <div className="relative">
              <div className="p-4 bg-blue-500 rounded-2xl shadow-xl">
                <Crown className="h-8 w-8 text-yellow-300" />
              </div>
              <div className="absolute -top-2 -right-2 p-1 bg-yellow-400 rounded-full animate-pulse">
                <Star className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold mb-2 text-gray-900">
            {subscriptionStatus?.hasActiveSubscription ? 'Manage Your Plan' : 'Choose Your Plan'}
          </h1>
          
          <p className="text-base text-gray-600 max-w-2xl mx-auto leading-normal">
            Get unlimited Microsoft Authenticator push verifications with our simple per-user pricing model designed for growing teams.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {availablePlans.map((plan, index) => (
            <div key={plan.id} className="relative w-full">
              {index === 0 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <Badge className="px-4 py-2 bg-blue-500 text-white border-0 shadow-lg text-sm font-semibold">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <Card className="relative border shadow-2xl bg-white overflow-hidden w-full px-6 py-6 rounded-3xl pt-12 h-full flex flex-col">
                <CardHeader className="text-center relative pb-3 px-1 flex-shrink-0">
                  {/* Plan Icon */}
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <div className="p-4 bg-blue-500 rounded-2xl shadow-xl">
                        <Zap className="h-8 w-8 text-white" />
                      </div>
                      <div className="absolute -top-1 -right-1 p-1 bg-yellow-400 rounded-full">
                        <Shield className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  </div>
                  
                  <CardTitle className="text-xl font-bold text-gray-900">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600 text-base mt-1">
                    {plan.description}
                  </CardDescription>
                  
                  {/* Pricing Section */}
                  {loadingCount ? (
                    <div className="mt-8">
                      <div className="animate-pulse space-y-3">
                        <div className="h-12 bg-gray-200 rounded-lg w-32 mx-auto"></div>
                        <div className="h-6 bg-gray-200 rounded w-40 mx-auto"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-white rounded-xl border">
                      <div className="text-3xl font-bold text-blue-600 mb-1">
                        {plan.formatted_price}
                      </div>
                      <div className="text-gray-600 text-base mb-2">per user per month</div>
                      
                      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Users className="h-5 w-5 text-blue-500" />
                          <span className="font-semibold text-gray-700">Organization Coverage</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {userCount} user{userCount !== 1 ? 's' : ''} × {plan.formatted_price} = ${userCount * (plan.amount / 100)}
                        </div>
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="relative px-1 pb-2 flex-1 flex flex-col">
                  {/* Features List */}
                  <div className="space-y-2 mb-4 flex-1">
                    {Object.entries(plan.features).map(([key, value]) => {
                      const featureText = formatFeature(key, value);
                      if (!featureText) return null;
                      
                      return (
                        <div key={key} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50">
                          <div className="p-1 bg-green-500 rounded-full mt-0.5">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-gray-700 font-medium">{featureText}</span>
                        </div>
                      );
                    })}
                    
                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                      <div className="p-1 bg-blue-500 rounded-full mt-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">
                        Covers all {userCount} admin & verifier users
                      </span>
                    </div>
                  </div>

                  {/* Warning for no users */}
                  {userCount === 0 && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-400 rounded-full">
                          <Users className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-orange-900 mb-1">No Users Found</p>
                          <p className="text-sm text-orange-800">
                            Your organization needs at least one admin or verifier user to subscribe.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subscribe Button */}
                  <Button
                    className={`w-full h-11 text-base font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 group/btn ${
                      isCurrentPlan(plan)
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white border-0 mt-auto`}
                    onClick={() => handleSubscribe(plan)}
                    disabled={isButtonDisabled(plan)}
                  >
                    <div className="flex items-center justify-center group-hover/btn:scale-105 transition-transform duration-300">
                      {getButtonText(plan)}
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(SubscriptionPlans);