'use client';
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import ChangeRequestTable from "@/components/ChangeRequestTable";
import ChangeRequestFilters from "@/components/ChangeRequestFilters";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BeautifulLoader } from "@/app/loader";
import { checkSubscriptionAccess } from '@/services/subscriptionService';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Sparkles, ListChecks } from 'lucide-react';
import { ChangeRequestsLogSkeleton } from '@/components/PageSkeletons';

// Define types for the change request
export type ChangeRequest = {
  id: string;
  user_email: string;
  status: string;
  notification_sent: boolean;
  completed_at: string | null;
  created_at: string;
  context_id: string | null;
  admin_object_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  tenant_id: string | null;
};

// Define filter options
export type FilterOptions = {
  search: string;
  status: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
};

const ChangeRequestsLog = () => {
  const { toast } = useToast();
  const { user, isLoading, isAuthenticated, isSessionExpired } = useAuth();
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    status: "",
    sortBy: "created_at",
    sortOrder: "desc",
    page: 1,
    pageSize: 10,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  // Get organization ID from authenticated user (only if user exists)
  const organizationId = user?.organization_id;
  
  const LOG_RETENTION_DAYS = 90; // <-- Change this to update log retention period
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - LOG_RETENTION_DAYS);
  const retentionDateString = retentionDate.toISOString();
  
  // Handle redirect for unauthenticated users (but not when session expired modal is showing)
  useEffect(() => {
    if (!isLoading && !checkingSubscription && (!isAuthenticated || !user) && !isSessionExpired) {
      window.location.href = '/';
    }
  }, [isLoading, checkingSubscription, isAuthenticated, user, isSessionExpired]);
  
  useEffect(() => {
    const fetchSubscription = async () => {
      if (user?.id) {
        setCheckingSubscription(true);
        try {
          const status = await checkSubscriptionAccess(user.id);
          setSubscriptionPlan(status?.subscription?.plan_name || null);
        } finally {
          setCheckingSubscription(false);
        }
      } else {
        setCheckingSubscription(false);
      }
    };
    fetchSubscription();
  }, [user]);

  // Fetch total count for pagination
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        if (!organizationId) return;
        let query : any = supabase
          .from('change_requests')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        // Apply retention based on plan type
        if (subscriptionPlan === 'BASIC' || subscriptionPlan === 'TRIAL') {
          // Basic/Trial: 3 months retention
          query = query.gte('created_at', retentionDateString);
        } else if (subscriptionPlan === 'PROFESSIONAL' || subscriptionPlan === 'ENTERPRISE') {
          // Professional/Enterprise: 1 year retention
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          query = query.gte('created_at', oneYearAgo.toISOString());
        }
        if (filters.search) {
          query = query.or(
            `user_email.ilike.%${filters.search}%,admin_name.ilike.%${filters.search}%,admin_email.ilike.%${filters.search}%`
          );
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        const { count, error } = await query;
        if (error) {
          console.error("Error in count query:", error);
          throw error;
        }
        setTotalCount(count || 0);
      } catch (error: any) {
        console.error('Error fetching count:', error);
        toast({
          title: "Error fetching data",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    if (subscriptionPlan !== null) fetchTotalCount();
  }, [filters.search, filters.status, organizationId, toast, retentionDateString, subscriptionPlan]);

  // Calculate pagination range
  const getPaginationRange = (page: number, pageSize: number) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  };

  // Fetch change requests with filters, sorting, and pagination
  const fetchChangeRequests = async () => {
    try {
      if (!organizationId) {
        console.warn("No organization ID available for fetching change requests");
        return [];
      }
      const { from, to } = getPaginationRange(filters.page, filters.pageSize);
      let query : any = supabase
        .from('change_requests')
        .select('*')
        .eq('organization_id', organizationId);
      // Apply retention based on plan type  
      if (subscriptionPlan === 'BASIC' || subscriptionPlan === 'TRIAL') {
        // Basic/Trial: 3 months retention
        query = query.gte('created_at', retentionDateString);
      } else if (subscriptionPlan === 'PROFESSIONAL' || subscriptionPlan === 'ENTERPRISE') {
        // Professional/Enterprise: 1 year retention
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        query = query.gte('created_at', oneYearAgo.toISOString());
      }
      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })
        .range(from, to);
      if (filters.search) {
        query = query.or(
          `user_email.ilike.%${filters.search}%,admin_name.ilike.%${filters.search}%,admin_email.ilike.%${filters.search}%`
        );
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      const { data, error } = await query;
      if (error) {
        console.error("Error in data query:", error);
        throw error;
      }
      return data as ChangeRequest[];
    } catch (error: any) {
      console.error('Error fetching change requests:', error);
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }
  };

  // Use React Query for data fetching with updated options for v5
  const { data: changeRequests, isLoading: isTableLoading, error, refetch } = useQuery({
    queryKey: ['changeRequests', filters, organizationId],
    queryFn: fetchChangeRequests,
    placeholderData: (previousData) => previousData, // Modern replacement for keepPreviousData
    enabled: !!organizationId && !checkingSubscription // Only run query if organizationId is available and subscription check is done
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      // Reset to first page when filters change
      ...(newFilters.search !== undefined || newFilters.status !== undefined || 
         newFilters.sortBy !== undefined || newFilters.sortOrder !== undefined
        ? { page: 1 }
        : {}),
    }));
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / filters.pageSize);

  // All hooks are called above this point - now we can have conditional returns

  // Show loader while checking authentication or subscription
  if (isLoading || checkingSubscription) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Header />
        <main className="flex-1 container py-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <ListChecks className="h-6 w-6" />
                  Change Requests Log
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <Shield className="h-4 w-4" />
              <span className="font-medium">{user?.organizations?.display_name || 'Organization'}</span>
            </div>
          </div>

          <ChangeRequestsLogSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  // Show loader while redirecting to login if not authenticated (but not when session expired modal is showing)
  if ((!isAuthenticated || !user) && !isSessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // If no organization ID available, show error
  if (!organizationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Missing Organization Information</h2>
          <p className="text-gray-600 mb-4">Unable to load change requests without organization information.</p>
          <Link href="/admin-portal">
            <Button>Return to Admin Portal</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-1 container py-12 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin-portal">
              <Button variant="outline" size="sm">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ListChecks className="h-6 w-6" />
                Change Requests Log
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-foreground">
            <Shield className="h-4 w-4" />
            <span className="font-medium">{user?.organizations?.display_name || 'Organization'}</span>
          </div>
        </div>
        {/* Filters and Table Section */}
        <div className="relative">
          <Card className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-gray-200/50 shadow-xl">
            <div className="mb-8">
              <ChangeRequestFilters 
                filters={filters}
                onFilterChange={handleFilterChange}
              />
            </div>
            <div className="mt-6">
              <ChangeRequestTable
                changeRequests={changeRequests || []}
                isLoading={isTableLoading}
                filters={filters}
                totalPages={totalPages}
                onFilterChange={handleFilterChange}
              />
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChangeRequestsLog;
