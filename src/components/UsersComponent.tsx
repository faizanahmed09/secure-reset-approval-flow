'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest, graphConfig } from '../authConfig';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, ArrowLeft, Search, SortAsc, SortDesc, Filter, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Loader from "@/components/common/Loader";

interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

type SortField = 'displayName' | 'userPrincipalName' | 'mail';
type SortOrder = 'asc' | 'desc';

const UsersComponent = () => {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [allUsers, setAllUsers] = useState<AzureUser[]>([]); // All fetched users
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('displayName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [displayedUsers, setDisplayedUsers] = useState<AzureUser[]>([]);
  const [itemsPerPage] = useState(20); // For client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const router = useRouter();
  const fetchCalled = useRef(false);
  const cacheTimestamp = useRef<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Optimized field selection
  const selectFields = ['id', 'displayName', 'userPrincipalName', 'mail'].join(',');

  useEffect(() => {
    const handleAuth = async () => {
      if (inProgress !== "none") {
        return;
      }

      if (!isAuthenticated || accounts.length === 0) {
        console.log("Not authenticated, redirecting to login");
        instance.loginRedirect(loginRequest);
        return;
      }

      if (!fetchCalled.current) {
        fetchCalled.current = true;
        await fetchAllUsers();
      }
    };

    handleAuth();
  }, [inProgress, isAuthenticated, accounts, instance]);

  // Client-side filtering and sorting
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = [...allUsers];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.displayName.toLowerCase().includes(query) ||
        user.userPrincipalName.toLowerCase().includes(query) ||
        (user.mail && user.mail.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = '';
      let bValue = '';

      switch (sortBy) {
        case 'displayName':
          aValue = a.displayName.toLowerCase();
          bValue = b.displayName.toLowerCase();
          break;
        case 'userPrincipalName':
          aValue = a.userPrincipalName.toLowerCase();
          bValue = b.userPrincipalName.toLowerCase();
          break;
        case 'mail':
          aValue = (a.mail || a.userPrincipalName).toLowerCase();
          bValue = (b.mail || b.userPrincipalName).toLowerCase();
          break;
      }

      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    return filtered;
  }, [allUsers, searchQuery, sortBy, sortOrder]);

  // Client-side pagination
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedUsers.slice(startIndex, endIndex);
  }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage);

  // Reset to first page when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, sortOrder]);

  const fetchAllUsers = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setAllUsers([]);
        setNextLink(null);
        setTotalCount(0);
        cacheTimestamp.current = Date.now();
      }
      setError(null);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const tokenResponse = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      // Build API endpoint
      const endpoint = isLoadMore && nextLink 
        ? nextLink 
        : `${graphConfig.graphUsersEndpoint}?$select=${selectFields}&$top=100&$count=true&$orderby=displayName asc`;

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
          'ConsistencyLevel': 'eventual',
        },
      });
      
      const newUsers = response.data.value || [];
      
      let updatedUsers: AzureUser[];
      if (isLoadMore) {
        updatedUsers = [...allUsers, ...newUsers];
      } else {
        updatedUsers = newUsers;
      }
      
      setAllUsers(updatedUsers);
      setNextLink(response.data['@odata.nextLink'] || null);
      
      // Set total count if available (only on first load)
      if (!isLoadMore && response.data['@odata.count']) {
        setTotalCount(response.data['@odata.count']);
      }
      
      const currentTotal = updatedUsers.length;
      const totalText = totalCount > 0 ? ` of ${totalCount}` : '';
      
      toast({
        title: isLoadMore ? "More Users Loaded" : "Users Loaded",
        description: `Successfully loaded ${currentTotal}${totalText} users from Azure AD`,
        duration: 1500,
      });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || "Failed to fetch users");
      
      toast({
        title: "Error Fetching Users",
        description: "Failed to fetch users from Azure AD",
        variant: "destructive",
      });
      
      if (error.name === "InteractionRequiredAuthError") {
        instance.acquireTokenRedirect(loginRequest);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreUsers = () => {
    if (nextLink && !loadingMore) {
      fetchAllUsers(true);
    }
  };

  const handleRefresh = () => {
    fetchCalled.current = false;
    setCurrentPage(1);
    fetchAllUsers();
    
    toast({
      title: "Data Refreshed",
      description: "Users data refreshed from server",
      duration: 1000,
    });
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const isDataStale = () => {
    return Date.now() - cacheTimestamp.current > CACHE_DURATION;
  };

  // Show loading state
  if (loading || inProgress !== "none") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader text="Loading users..." subtext="Fetching users from Azure AD..." />
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-red-600">Error Loading Users</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <Button onClick={() => {
              setError(null);
              fetchCalled.current = false;
              fetchAllUsers();
            }}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.push('/admin-portal')}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl mx-auto">
      <Button 
        variant="outline" 
        className="mb-6" 
        onClick={() => router.push('/admin-portal')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Button>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-6 w-6 text-blue-600" />
              <span>Azure AD Users</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isDataStale() ? "destructive" : "outline"} className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                {allUsers.length} users loaded {isDataStale() && '(Stale)'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Manage and search users from your Azure Active Directory (Client-side filtering)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search users by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(value: SortField) => handleSortChange(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="displayName">Display Name</SelectItem>
                  <SelectItem value="userPrincipalName">Email</SelectItem>
                  <SelectItem value="mail">Alternate Email</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Load More Users Section */}
          {nextLink && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900">More users available</p>
                  <p className="text-xs text-blue-700">
                    Loaded {allUsers.length} of {totalCount > 0 ? totalCount : 'many'} users
                  </p>
                </div>
                <Button 
                  onClick={loadMoreUsers} 
                  disabled={loadingMore}
                  variant="outline"
                  size="sm"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Results Info */}
          {allUsers.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} filtered users
                ({allUsers.length} total loaded)
              </span>
              {searchQuery && (
                <Badge variant="outline">
                  <Filter className="h-3 w-3 mr-1" />
                  Filtered by: "{searchQuery}"
                </Badge>
              )}
              <Badge variant="outline">
                Sorted by {sortBy} ({sortOrder})
              </Badge>
            </div>
          )}
          
          {/* Users List */}
          {paginatedUsers.length > 0 ? (
            <div className="space-y-4">
              {paginatedUsers.map((user: AzureUser) => (
                <div key={user.id} className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-lg">{user.displayName}</div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">
                        <span className="font-medium">Email:</span> {user.userPrincipalName}
                      </div>
                      {user.mail && user.mail !== user.userPrincipalName && (
                        <div className="text-blue-600">
                          <span className="font-medium">Alt Email:</span> {user.mail}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Client-side Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 pt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                  
                  <span className="text-sm text-muted-foreground ml-4">
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {searchQuery ? (
                  <>
                    <p className="text-lg font-medium">No users found</p>
                    <p>No users match your search criteria</p>
                  </>
                ) : allUsers.length === 0 ? (
                  <>
                    <p className="text-lg font-medium">No users found</p>
                    <p>Check your permissions or try refreshing</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium">No users match filters</p>
                    <p>Try adjusting your search criteria</p>
                  </>
                )}
              </div>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersComponent;