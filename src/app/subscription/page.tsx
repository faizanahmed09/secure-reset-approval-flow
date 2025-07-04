'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import SubscriptionStatusComponent from '@/components/SubscriptionStatus';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import { BeautifulLoader } from '@/app/loader';
import { getSubscriptionStatus, SubscriptionStatus } from '@/services/subscriptionService';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const SubscriptionPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subStatusLoading, setSubStatusLoading] = useState(true);

  // Handle redirect for unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/';
    }
  }, [isLoading, isAuthenticated]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-50">
        <BeautifulLoader />
      </div>
    );
  }

  // Show loader while redirecting to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-50">
        <BeautifulLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      
      <main className="flex-1 container py-12 relative">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-1 h-12 bg-blue-500 rounded-full"></div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Your Plan</h2>
              <p className="text-gray-600">Control your billing and subscription preferences</p>
            </div>
          </div>
          
          <Link href="/admin-portal">
            <Button 
              variant="outline" 
              size="sm" 
              className="group border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
              Back to Portal
            </Button>
          </Link>
        </div>

        {/* Current Subscription Status */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Star className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Current Subscription</h3>
          </div>
          
          <div className="transform hover:scale-[1.02] transition-transform duration-300">
            <SubscriptionStatusComponent userId={user?.id} showManagement={true} />
          </div>
        </div>

        {/* Available Plans Section */}
        <div className="space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Available Plans</h3>
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the perfect plan that fits your organization's needs and unlock powerful features
            </p>
          </div>
          
          <div className="relative">
            <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200/50 shadow-xl">
              <SubscriptionPlans subscriptionStatus={subscriptionStatus} plans={[]} />
            </div>
          </div>
        </div>

        {/* Bottom CTA Section */}
        <div className="mt-20 text-center">
          <div className="bg-white rounded-2xl p-8 text-gray-800 relative overflow-hidden border">
            <div className="relative">
              <h4 className="text-2xl font-bold mb-4">Need Help Choosing?</h4>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Our team is here to help you find the perfect plan for your organization's unique needs.
              </p>
              <Button 
                variant="secondary" 
                className="bg-gray-800 text-white hover:bg-gray-700 border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => window.open('mailto:support@authenpush.com', '_blank')}
              >
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default SubscriptionPage;