
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import ChangeRequestTable from "@/components/ChangeRequestTable";
import ChangeRequestFilters from "@/components/ChangeRequestFilters";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Define types for the change request
export type ChangeRequest = {
  id: string;
  user_email: string;
  status: string;
  notification_sent: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  context_id: string | null;
  admin_object_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
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
  const [filters, setFilters] = useState<FilterOptions>({
    search: "",
    status: "",
    sortBy: "created_at",
    sortOrder: "desc",
    page: 1,
    pageSize: 10,
  });
  const [totalCount, setTotalCount] = useState(0);
  
  // Fetch total count for pagination
  useEffect(() => {
    const fetchTotalCount = async () => {
      try {
        console.log("Fetching total count with filters:", filters);
        
        // Basic query without filters first to check if we can get any data
        let countQuery = supabase
          .from('change_requests')
          .select('id', { count: 'exact', head: true });
        
        const { count: basicCount, error: basicError } = await countQuery;
        console.log("Basic count query result (no filters):", basicCount);
        
        if (basicError) {
          console.error("Error in basic count query:", basicError);
        }
        
        // Now try with filters
        let query = supabase
          .from('change_requests')
          .select('id', { count: 'exact', head: true });
        
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
  }, [filters.search, filters.status, toast]);

  // Calculate pagination range
  const getPaginationRange = (page: number, pageSize: number) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  };

  // Fetch change requests with filters, sorting, and pagination
  const fetchChangeRequests = async () => {
    try {
      console.log("Fetching change requests with filters:", filters);
      
      // First, let's try a basic query to see if we can get any data
      const basicQuery = supabase.from('change_requests').select('*').limit(1);
      const { data: basicData, error: basicError } = await basicQuery;
      
      console.log("Basic query test result:", basicData);
      
      if (basicError) {
        console.error("Error in basic data query:", basicError);
      }
      
      // Now proceed with filtered query
      const { from, to } = getPaginationRange(filters.page, filters.pageSize);
      
      let query = supabase
        .from('change_requests')
        .select('*')
        .order(filters.sortBy, { ascending: filters.sortOrder === 'asc' })
        .range(from, to);
      
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
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error in data query:", error);
        throw error;
      }
      
      console.log("Fetched data:", data);
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
  const { data: changeRequests, isLoading, error, refetch } = useQuery({
    queryKey: ['changeRequests', filters],
    queryFn: fetchChangeRequests,
    placeholderData: (previousData) => previousData // Modern replacement for keepPreviousData
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="mb-8">
          <Link to="/">
            <Button variant="outline" size="sm" className="mb-4">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Change Requests Log</h1>
          <p className="text-muted-foreground mt-2">
            View and manage recent change requests in the system
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
            isLoading={isLoading}
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
