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
import { useRouter } from "next/navigation";
import { BeautifulLoader } from "@/app/loader";
import { checkSubscriptionAccess } from '@/services/subscriptionService';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Sparkles, ListChecks } from 'lucide-react';

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
  const router = useRouter();
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

  // Get tenant ID from authenticated user (only if user exists)
  const tenantId = user?.tenant_id;
  
  const LOG_RETENTION_DAYS = 90; // <-- Change this to update log retention period
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - LOG_RETENTION_DAYS);
  const retentionDateString = retentionDate.toISOString();
  
  // Handle redirect for unauthenticated users (but not when session expired modal is showing)
  useEffect(() => {
    if (!isLoading && !checkingSubscription && (!isAuthenticated || !user) && !isSessionExpired) {
      router.push('/');
    }
  }, [isLoading, checkingSubscription, isAuthenticated, user, isSessionExpired, router]);
  
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
        if (!tenantId) return;
        let query : any = supabase
          .from('change_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        // Only apply retention for STARTER or TRIAL plan
        if (subscriptionPlan === 'STARTER' || subscriptionPlan === 'TRIAL') {
          query = query.gte('created_at', retentionDateString);
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
  }, [filters.search, filters.status, tenantId, toast, retentionDateString, subscriptionPlan]);

  // Calculate pagination range
  const getPaginationRange = (page: number, pageSize: number) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  };

  // Fetch change requests with filters, sorting, and pagination
  const fetchChangeRequests = async () => {
    try {
      if (!tenantId) {
        console.warn("No tenant ID available for fetching change requests");
        return [];
      }
      const { from, to } = getPaginationRange(filters.page, filters.pageSize);
      let query : any = supabase
        .from('change_requests')
        .select('*')
        .eq('tenant_id', tenantId);
      // Only apply retention for STARTER or TRIAL plan
      if (subscriptionPlan === 'STARTER' || subscriptionPlan === 'TRIAL') {
        query = query.gte('created_at', retentionDateString);
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
    queryKey: ['changeRequests', filters, tenantId],
    queryFn: fetchChangeRequests,
    placeholderData: (previousData) => previousData, // Modern replacement for keepPreviousData
    enabled: !!tenantId && !checkingSubscription // Only run query if tenantId is available and subscription check is done
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
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
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

  // If no tenant ID available, show error
  if (!tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Missing Tenant Information</h2>
          <p className="text-gray-600 mb-4">Unable to load change requests without tenant information.</p>
          <Link href="/admin-portal">
            <Button>Return to Admin Portal</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-blue-100/50 to-blue-50">
      <Header />
      <main className="flex-1 container py-12 relative">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-1 h-12 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Verify User Request Logs</h2>
              <p className="text-gray-600">View and manage recent verify user requests in the system</p>
            </div>
          </div>
          <Link href="/admin-portal">
            <Button 
              variant="outline" 
              size="sm" 
              className="group border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-all duration-300"
            >
              <ChevronLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-300" />
              Back to Home
            </Button>
          </Link>
        </div>
        {/* Filters and Table Section */}
        <div className="relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 via-purple-100/50 to-pink-100/50 rounded-3xl transform rotate-1"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-pink-100/50 via-blue-100/50 to-purple-100/50 rounded-3xl transform -rotate-1"></div>
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
