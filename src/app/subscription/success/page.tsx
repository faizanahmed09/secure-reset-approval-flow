'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionStatus } from '@/services/subscriptionService';

const SubscriptionSuccessPage = () => {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 4; // Try for about 30 seconds

  useEffect(() => {
    if (user?.id) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    if (!user?.id) return;

    try {
      const status = await getSubscriptionStatus(user.id);
      setSubscription(status.subscription);
      
      // If still showing trial and we haven't hit max retries, keep checking
      if (status.subscription?.plan_name === 'TRIAL' && retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchSubscription();
        }, 5000); // Check every 5 seconds
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setLoading(false);
    }
  };

  const formatNextBilling = (subscription: any) => {
    if (!subscription) return 'Not available';
    
    // For paid subscriptions, use current_period_end
    if (subscription.plan_name === 'BASIC' && subscription.current_period_end) {
      return new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    
    // For trials, use trial_end_date
    if (subscription.plan_name === 'TRIAL' && subscription.trial_end_date) {
      return `Trial ends ${new Date(subscription.trial_end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`;
    }
    
    return 'Not available';
  };

  const isStillProcessing = subscription?.plan_name === 'TRIAL' && sessionId && retryCount < maxRetries;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            {isStillProcessing ? (
              <AlertTriangle className="h-10 w-10 text-yellow-600" />
            ) : (
              <CheckCircle className="h-10 w-10 text-green-600" />
            )}
          </div>
          <CardTitle className={`text-2xl ${isStillProcessing ? 'text-yellow-600' : 'text-green-600'}`}>
            {isStillProcessing ? 'Processing Your Subscription...' : 'Subscription Successful!'}
          </CardTitle>
          <CardDescription className="text-lg">
            {isStillProcessing 
              ? 'Your payment was successful. We\'re setting up your subscription...' 
              : 'Welcome to your new plan! Your subscription is now active.'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading || isStillProcessing ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {isStillProcessing 
                  ? `Checking subscription status... (${retryCount + 1}/${maxRetries + 1})` 
                  : 'Setting up your subscription...'
                }
              </p>
              {isStillProcessing && (
                <p className="text-sm text-gray-500 mt-2">
                  This may take up to 30 seconds. Your payment was successful.
                </p>
              )}
            </div>
          ) : subscription ? (
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscription Details
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Plan</p>
                  <p className="font-semibold">{subscription.plan?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Billing Amount</p>
                  <p className="font-semibold">{subscription.plan?.formatted_price} per {subscription.plan?.interval}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold text-green-600">
                    {subscription.plan_name === 'TRIAL' ? 'Trial Active' : 'Active'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Next Billing</p>
                  <p className="font-semibold">
                    {formatNextBilling(subscription)}
                  </p>
                </div>
              </div>
              
              {subscription.plan_name === 'TRIAL' && sessionId && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Subscription Processing</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your payment was successful, but we're still processing your subscription upgrade. 
                        This usually takes a few moments. You can refresh this page or check back shortly.
                      </p>
                      {sessionId && (
                        <p className="text-xs text-yellow-600 mt-2">
                          Session ID: {sessionId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Your subscription is being processed. It may take a few moments to appear in your account.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold">What's Next?</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• You now have access to all features in your plan</li>
              <li>• Check your email for a confirmation and receipt</li>
              <li>• You can manage your subscription anytime from your account</li>
              <li>• Need help? Contact our support team</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/subscription" className="flex-1">
              <Button className="w-full">
                Manage Subscription
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/admin-portal" className="flex-1">
              <Button variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </div>

          {sessionId && !isStillProcessing && (
            <p className="text-xs text-gray-500 text-center">
              Session ID: {sessionId}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccessPage; 