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
  const { user, isLoading, isAuthenticated } = useAuth();
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

  // Get tenant ID from authenticated user (only if user exists)
  const tenantId = user?.tenant_id;

  // Fetch total count for pagination
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        // Only proceed if we have a tenant ID
        if (!tenantId) return;

        // Now try with filters
        let query : any = supabase
          .from('change_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
        
        // Apply search filter if provided
        if (filters.search) {
          query = query.or(
            `user_email.ilike.%${filters.search}%,admin_name.ilike.%${filters.search}%,admin_email.ilike.%${filters.search}%`
          );
        }
        
        // Apply status filter if provided
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        
        const { count, error } = await query;
        
        if (error) {
          console.error("Error in count query:", error);
          throw error;
        }
        
        console.log("Filtered count result:", count);
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
    
    fetchTotalCount();
  }, [filters.search, filters.status, tenantId, toast]);

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
        .eq('tenant_id', tenantId)
        .order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })
        .range(from, to);
  
      // Apply other filters if provided
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
    enabled: !!tenantId // Only run query if tenantId is available
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

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Redirect to admin portal if not authenticated
  if (!isAuthenticated || !user) {
    router.push('/admin-portal');
    return null;
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="mb-8">
          <Link href="/admin-portal">
            <Button variant="outline" size="sm" className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Verify User Request Logs</h1>
          <p className="text-muted-foreground mt-2">
            View and manage recent verify users requests in the system
          </p>
        </div>

        {/* Filters section */}
        <ChangeRequestFilters 
          filters={filters}
          onFilterChange={handleFilterChange}
        />
        
        {/* Table section */}
        <div className="mt-6 border rounded-md">
          <ChangeRequestTable
            changeRequests={changeRequests || []}
            isLoading={isTableLoading}
            filters={filters}
            totalPages={totalPages}
            onFilterChange={handleFilterChange}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ChangeRequestsLog;
