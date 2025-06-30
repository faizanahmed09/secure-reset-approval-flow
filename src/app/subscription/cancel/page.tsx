'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const SubscriptionCancelPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
            <XCircle className="h-10 w-10 text-orange-600" />
          </div>
          <CardTitle className="text-2xl text-orange-600">Subscription Cancelled</CardTitle>
          <CardDescription className="text-lg">
            Your subscription process was cancelled. No charges were made.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-orange-50 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">What happened?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• You cancelled the subscription process</li>
              <li>• No payment was processed</li>
              <li>• Your account remains unchanged</li>
              <li>• You can try again anytime</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Need Help?</h3>
            <p className="text-sm text-gray-600">
              If you encountered any issues or have questions about our plans, feel free to contact our support team. 
              We're here to help you choose the right plan for your needs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/subscription" className="flex-1">
              <Button className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </Link>
            <Link href="/admin-portal" className="flex-1">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a 
                href="mailto:support@authenpush.com" 
                className="text-blue-600 hover:underline"
              >
                support@authenpush.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionCancelPage; 