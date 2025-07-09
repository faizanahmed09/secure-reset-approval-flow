import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for SubscriptionStatus component
export const SubscriptionStatusSkeleton = () => (
  <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-50">
    {/* Background decorations */}
    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-300/30 to-blue-400/30 rounded-full blur-3xl"></div>
    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-tr from-blue-200/20 to-blue-300/20 rounded-full blur-2xl"></div>
    
    <CardHeader className="relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="absolute -top-1 -right-1">
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
          </div>
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </CardHeader>

    <CardContent className="space-y-6 relative">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Billing Amount Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Next Billing Card */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border border-white/50 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>

      {/* Management Button */}
      <div className="pt-4">
        <Skeleton className="w-full h-12 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

// Skeleton for individual subscription plan card
export const SubscriptionPlanCardSkeleton = ({ isPopular = false }: { isPopular?: boolean }) => (
  <div className="relative w-full">
    {isPopular && (
      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    )}
    
    <Card className="relative border shadow-2xl bg-white overflow-hidden w-full px-6 py-6 rounded-3xl pt-12 h-full flex flex-col">
      <CardHeader className="text-center relative pb-3 px-1 flex-shrink-0">
        {/* Plan Icon */}
        <div className="flex justify-center mb-2">
          <div className="relative">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="absolute -top-1 -right-1">
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        </div>
        
        <Skeleton className="h-6 w-24 mx-auto mb-2" />
        <Skeleton className="h-4 w-48 mx-auto mb-4" />
        
        {/* Pricing Section */}
        <div className="mt-4 p-4 bg-white rounded-xl border">
          <Skeleton className="h-9 w-20 mx-auto mb-1" />
          <Skeleton className="h-4 w-32 mx-auto mb-2" />
          
          <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-28 mx-auto" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative px-1 pb-2 flex-1 flex flex-col">
        {/* Features List */}
        <div className="space-y-2 mb-4 flex-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-gray-200">
              <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
          
          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <Skeleton className="h-5 w-5 rounded-full mt-0.5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Subscribe Button */}
        <Skeleton className="w-full h-11 rounded-lg mt-auto" />
      </CardContent>
    </Card>
  </div>
);

// Skeleton for SubscriptionPlans component
export const SubscriptionPlansSkeleton = () => (
  <div className="bg-white">
    <div className="container mx-auto py-6">
      {/* Header Section */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <div className="relative">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="absolute -top-2 -right-2">
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        </div>
        
        <Skeleton className="h-9 w-64 mx-auto mb-2" />
        <Skeleton className="h-4 w-96 mx-auto" />
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        <SubscriptionPlanCardSkeleton isPopular={true} />
        <SubscriptionPlanCardSkeleton />
        <SubscriptionPlanCardSkeleton />
      </div>
    </div>
  </div>
);

// Combined skeleton for the entire subscription page
export const SubscriptionPageSkeleton = () => (
  <div className="space-y-16">
    {/* Current Subscription Section */}
    <div className="mb-16">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-48" />
      </div>
      <SubscriptionStatusSkeleton />
    </div>

    {/* Available Plans Section */}
    <div className="space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-96 mx-auto" />
      </div>
      
      <div className="relative">
        <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200/50 shadow-xl">
          <SubscriptionPlansSkeleton />
        </div>
      </div>
    </div>
  </div>
); 