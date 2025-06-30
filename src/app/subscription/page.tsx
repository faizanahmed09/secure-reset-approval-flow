'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import SubscriptionStatusComponent from '@/components/SubscriptionStatus';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { BeautifulLoader } from '@/app/loader';
import { getSubscriptionStatus, SubscriptionStatus } from '@/services/subscriptionService';

const SubscriptionPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subStatusLoading, setSubStatusLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (user?.id) {
        setSubStatusLoading(true);
        try {
          const status = await getSubscriptionStatus(user.id);
          setSubscriptionStatus(status);
        } finally {
          setSubStatusLoading(false);
        }
      }
    };
    fetchStatus();
  }, [user]);

  if (isLoading || subStatusLoading) {
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
            <CardDescription>Please log in to access subscription management.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subscription Management</h1>
          <p className="text-gray-600">Manage your subscription and billing preferences</p>
        </div>
        <Link href="/admin-portal">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Portal
          </Button>
        </Link>
      </div>

      {/* Show current subscription status */}
      <div className="mb-10">
        <SubscriptionStatusComponent userId={user?.id} showManagement={true} />
      </div>

      {/* Show available plans */}
      <div>
        <h2 className="text-xl font-semibold mb-6">Available Plans</h2>
        <SubscriptionPlans subscriptionStatus={subscriptionStatus} plans={[]} />
      </div>
    </div>
  );
};

export default SubscriptionPage;