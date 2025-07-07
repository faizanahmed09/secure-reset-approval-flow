'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, CreditCard, AlertTriangle } from 'lucide-react';
import { checkSubscriptionAccess } from '@/services/subscriptionService';
import { BeautifulLoader } from '@/app/loader';
import { useRouter } from 'next/navigation';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  feature?: string;
}

const SubscriptionGuard = ({ children, feature = "this feature" }: SubscriptionGuardProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [accessStatus, setAccessStatus] = useState<{
    hasAccess: boolean;
    reason?: string;
    subscription?: any;
  } | null>(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      if (user?.id) {
        setChecking(true);
        try {
          const status = await checkSubscriptionAccess(user.id);
          setAccessStatus(status);
        } finally {
          setChecking(false);
        }
      }
    };

    if (isAuthenticated && user?.id) {
      checkAccess();
    } else if (!isLoading) {
      setChecking(false);
    }
  }, [user, isAuthenticated, isLoading]);

  const handleSubscribe = () => {
    router.push('/subscription');
  };

  // Show loader while checking
  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to access {feature}.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => router.push('/')}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show subscription prompt if no access
  if (accessStatus && !accessStatus.hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle className="text-xl">Subscription Required</CardTitle>
            <CardDescription>
              {accessStatus.reason || `You need an active subscription to access ${feature}.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {accessStatus.subscription?.plan_name === 'RESTRICTED' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your trial period has ended. Please subscribe to continue using our services.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center">
              <Button 
                onClick={handleSubscribe}
                className="w-full flex items-center justify-center gap-2"
              >
                <CreditCard className="h-4 w-4" />
                View Subscription Plans
              </Button>
            </div>

            <div className="text-center">
              <Button 
                variant="outline"
                onClick={() => router.push('/admin-portal')}
                className="w-full"
              >
                Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render children if access is granted
  return <>{children}</>;
};

export default SubscriptionGuard; 