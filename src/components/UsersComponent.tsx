'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest, graphConfig } from '../userAuthConfig';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Users, ArrowLeft, Search, SortAsc, SortDesc, Filter, RefreshCw, Database, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Loader from "@/components/common/Loader";
import { debounce } from 'lodash';
import { getAccessToken } from '@/services/userService';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import UserFilters, { UserFilterOptions, SortField, SortOrder } from '@/components/UserFilters';

interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

interface CacheEntry {
  users: AzureUser[];
  totalCount: number;
  nextLink: string | null;
  timestamp: number;
  searchQuery: string;
  sortBy: string;
  sortOrder: string;
}

// Cache implementation
class UserCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(searchQuery: string, sortBy: string, sortOrder: string, page: number): string {
    return `${searchQuery}|${sortBy}|${sortOrder}|${page}`;
  }

  get(searchQuery: string, sortBy: string, sortOrder: string, page: number): CacheEntry | null {
    const key = this.getCacheKey(searchQuery, sortBy, sortOrder, page);
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < this.CACHE_DURATION) {
      return entry;
    }
    
    if (entry) {
      this.cache.delete(key);
    }
    
    return null;
  }

  set(searchQuery: string, sortBy: string, sortOrder: string, page: number, data: Omit<CacheEntry, 'timestamp' | 'searchQuery' | 'sortBy' | 'sortOrder'>): void {
    const key = this.getCacheKey(searchQuery, sortBy, sortOrder, page);
    this.cache.set(key, {
      ...data,
      timestamp: Date.now(),
      searchQuery,
      sortBy,
      sortOrder
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

const UsersComponent = () => {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  
  const tenantId = accounts[0]?.tenantId;
  const upn = accounts[0]?.username;
  const tenantDomain = upn?.split('@')[1];

  const [users, setUsers] = useState<AzureUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [filters, setFilters] = useState<UserFilterOptions>({
    search: '',
    sortBy: 'displayName',
    sortOrder: 'asc'
  });
  const [currentPage, setCurrentPage] = useState(0);
  const { toast } = useToast();
  const router = useRouter();
  const fetchCalled = useRef(false);
  const userCache = useRef(new UserCache());
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  const handleFilterChange = (newFilters: Partial<UserFilterOptions>) => {
    setFilters(prev => ({...prev, ...newFilters}));
  };

  // Optimized field selection for better performance
  const selectFields = [
    'id',
    'displayName', 
    'userPrincipalName',
    'mail'
  ].join(',');

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        // If search query is too short, fetch initial users
        setCurrentPage(0);
        fetchCalled.current = false;
        await fetchUsers(false, '');
        return;
      }

      await searchUsers(query);
    }, 500),
    [filters.sortBy, filters.sortOrder]
  );

  useEffect(() => {
    const handleAuth = async () => {
      if (inProgress !== "none") {
        return;
      }

      if (!isAuthenticated || accounts.length === 0) {
        console.log("Not authenticated, user should be redirected by parent page");
        return;
      }

      if (!fetchCalled.current) {
        fetchCalled.current = true;
        await fetchUsers();
      }
    };

    handleAuth();
  }, [inProgress, isAuthenticated, accounts, instance]);

  // Handle search input change
  useEffect(() => {
    debouncedSearch(filters.search);
  }, [filters.search, debouncedSearch]);

  // Handle sort changes
  useEffect(() => {
    if (fetchCalled.current) {
      setCurrentPage(0);
      fetchCalled.current = false;
      if (filters.search.trim().length >= 2) {
        searchUsers(filters.search);
      } else {
        fetchUsers(false, '');
      }
    }
  }, [filters.sortBy, filters.sortOrder]);

  const buildApiEndpoint = (isLoadMore: boolean, query: string = ''): string => {
    let endpoint = `${graphConfig.graphUsersEndpoint}`;
    const params = new URLSearchParams();

    // Add field selection
    params.append('$select', selectFields);
    
    // Add pagination
    params.append('$top', '50');
    
    // Add count (only for initial load)
    if (!isLoadMore) {
      params.append('$count', 'true');
    }

    // Add search filter
    if (query.trim()) {
      // Use $search with proper property:value format for Microsoft Graph
      params.append('$search', `"displayName:${query}" OR "mail:${query}" OR "userPrincipalName:${query}"`);
      // Don't add orderby when using search
    } else {
      // Add sorting only when not searching
      const sortDirection = filters.sortOrder === 'desc' ? 'desc' : 'asc';
      params.append('$orderby', `${filters.sortBy} ${sortDirection}`);
    }

    return `${endpoint}?${params.toString()}`;
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      return;
    }

    try {
      // Cancel previous search request
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      
      // Create new AbortController for this search
      searchAbortControllerRef.current = new AbortController();

      setSearchLoading(true);
      setError(null);

      // Check cache first
      const cachedData = userCache.current.get(query, filters.sortBy, filters.sortOrder, 0);
      if (cachedData) {
        setUsers(cachedData.users);
        setTotalCount(cachedData.totalCount);
        setNextLink(cachedData.nextLink);
        setSearchLoading(false);
        
        toast({
          title: "Search Results from Cache",
          description: `Found ${cachedData.users.length} users from cache`,
          duration: 1000,
        });
        return;
      }
      
      const accessToken = await getAccessToken(instance, accounts);

      const endpoint = buildApiEndpoint(false, query);

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'ConsistencyLevel': 'eventual',
        },
        signal: searchAbortControllerRef.current.signal,
      });
      
      const searchResults = response.data.value || [];
      
      setUsers(searchResults);
      setCurrentPage(0);
      
      // Set pagination info
      setNextLink(response.data['@odata.nextLink'] || null);
      
      // Set total count if available
      const newTotalCount = response.data['@odata.count'] || searchResults.length;
      setTotalCount(newTotalCount);

      // Cache the search results
      userCache.current.set(query, filters.sortBy, filters.sortOrder, 0, {
        users: searchResults,
        totalCount: newTotalCount,
        nextLink: response.data['@odata.nextLink'] || null
      });
      
      const totalText = newTotalCount > 0 ? ` (${newTotalCount} total)` : '';
      
      toast({
        title: "Search Completed",
        description: `Found ${searchResults.length} users${totalText}`,
        duration: 1500,
      });
    } catch (error: any) {
      // Don't handle error if request was cancelled
      if (error.name === 'AbortError' || axios.isCancel(error)) {
        return;
      }

      console.error('Error searching users:', error);
      setError(error.message || "Failed to search users");
      
      const isAuthError = error.message?.includes("authentication") || error.message?.includes("token");
      
      toast({
        title: "Search Error",
        description: isAuthError ? "Authentication expired. Please refresh the page." : "Failed to search users from Azure AD",
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchUsers = async (isLoadMore = false, query: string = '') => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setUsers([]);
        setNextLink(null);
        setTotalCount(0);
      }
      setError(null);

      // Check cache first (only for non-search queries)
      if (!query) {
        const cachedData = userCache.current.get('', filters.sortBy, filters.sortOrder, isLoadMore ? currentPage + 1 : 0);
        if (cachedData && !isLoadMore) {
          setUsers(cachedData.users);
          setTotalCount(cachedData.totalCount);
          setNextLink(cachedData.nextLink);
          setLoading(false);
          
          toast({
            title: "Users Loaded from Cache",
            description: `Loaded ${cachedData.users.length} users from cache`,
            duration: 1000,
          });
          return;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const accessToken = await getAccessToken(instance, accounts);

      // Use nextLink for pagination or build new endpoint
      const endpoint = isLoadMore && nextLink 
        ? nextLink 
        : buildApiEndpoint(isLoadMore, query);

      const response = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'ConsistencyLevel': 'eventual',
        },
      });
      
      const newUsers = response.data.value || [];
      
      let updatedUsers: AzureUser[];
      if (isLoadMore) {
        updatedUsers = [...users, ...newUsers];
        setUsers(updatedUsers);
        setCurrentPage(prev => prev + 1);
      } else {
        updatedUsers = newUsers;
        setUsers(newUsers);
        setCurrentPage(0);
      }
      
      // Set pagination info
      const newNextLink = response.data['@odata.nextLink'] || null;
      setNextLink(newNextLink);
      
      // Set total count if available (only on first load)
      let newTotalCount = totalCount;
      if (!isLoadMore && response.data['@odata.count']) {
        newTotalCount = response.data['@odata.count'];
        setTotalCount(newTotalCount);
      }

      // Cache the results (only for non-search queries)
      if (!isLoadMore && !query) {
        userCache.current.set('', filters.sortBy, filters.sortOrder, 0, {
          users: updatedUsers,
          totalCount: newTotalCount,
          nextLink: newNextLink
        });
      }
      
      const currentTotal = updatedUsers.length;
      const totalText = newTotalCount > 0 ? ` of ${newTotalCount}` : '';
      
      toast({
        title: isLoadMore ? "More Users Loaded" : "Users Loaded",
        description: `Successfully loaded ${currentTotal}${totalText} users from Azure AD`,
        duration: 1500,
      });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setError(error.message || "Failed to fetch users");
      
      const isAuthError = error.message?.includes("authentication") || error.message?.includes("token");
      
      toast({
        title: "Error Fetching Users",
        description: isAuthError ? "Authentication expired. Please refresh the page." : "Failed to fetch users from Azure AD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreUsers = () => {
    if (nextLink && !loadingMore) {
      if (filters.search.trim().length >= 2) {
        // For search results, we might need to implement search pagination differently
        // For now, just show that more results are available
        toast({
          title: "Load More",
          description: "Clear search to load more users or refine your search",
          duration: 2000,
        });
      } else {
        fetchUsers(true);
      }
    }
  };

  const handleRefresh = () => {
    userCache.current.clear();
    fetchCalled.current = false;
    setCurrentPage(0);
    
    if (filters.search.trim().length >= 2) {
      searchUsers(filters.search);
    } else {
      fetchUsers(false, '');
    }
    
    toast({
      title: "Cache Cleared",
      description: "Users data refreshed from server",
      duration: 1000,
    });
  };

  const handleSendApproval = useCallback((user: AzureUser) => {
    router.push(`/admin-portal/reset-approval?user=${encodeURIComponent(user.userPrincipalName)}`);
  }, [router]);

  // Memoized user list to prevent unnecessary re-renders
  const UserList = useMemo(() => {
    return users.map((user: AzureUser) => (
      <div key={user.id} className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-lg">{user.displayName}</div>
            <div className="text-sm text-muted-foreground">{user.userPrincipalName}</div>
            {user.mail && user.mail !== user.userPrincipalName && (
              <div className="text-sm text-blue-600">{user.mail}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center space-x-4 pl-4">
              <a 
                href={`https://entra.microsoft.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId/${user.id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                title="Open user in Entra portal"
              >
                <img src="/Microsoft-entra-logo.png" alt="Entra Portal" className="h-12 w-12" />
              </a>
              <button 
                onClick={() => handleSendApproval(user)}
                title="Send approval request"
              >
                <Send className="h-8 w-8 text-blue-600 hover:text-blue-800 transition-colors" />
              </button>
          </div>
        </div>
      </div>
    ));
  }, [users, handleSendApproval]);

  // Show loading state only for initial load
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
              fetchUsers();
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
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      <main className="flex-1 container py-12">
        <div className="max-w-7xl mx-auto">
          <Button 
            variant="outline" 
            className="mb-6" 
            onClick={() => router.push('/admin-portal')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <div className="relative">
            <Card className="relative w-full bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-6 w-6 text-blue-600" />
                    <span>Entra ID Users</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      Cache: {userCache.current.getSize()} entries
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={loading || searchLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${(loading || searchLoading) ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Search for your user in Entra ID
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserFilters 
                  filters={filters} 
                  onFilterChange={handleFilterChange} 
                  searchLoading={searchLoading} 
                />
                {/* Results Info */}
                {users.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      Showing {users.length}{totalCount > 0 ? ` of ${totalCount}` : ''} users
                    </span>
                    {filters.search && filters.search.length >= 2 && (
                      <Badge variant="outline">
                        <Filter className="h-3 w-3 mr-1" />
                        Search: "{filters.search}"
                      </Badge>
                    )}
                    {nextLink && (
                      <Badge variant="outline" className="text-blue-600">
                        More available
                      </Badge>
                    )}
                  </div>
                )}
                {users.length > 0 ? (
                  <div className="space-y-4">
                    {UserList}
                    {nextLink && (
                      <div className="flex justify-center pt-6">
                        <Button 
                          onClick={loadMoreUsers} 
                          disabled={loadingMore}
                          variant="outline"
                          className="w-full max-w-sm"
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading more users...
                            </>
                          ) : (
                            <>
                              Load More Users
                              {totalCount > 0 && (
                                <span className="ml-2 text-xs">
                                  ({users.length}/{totalCount})
                                </span>
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground mb-4">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      {filters.search && filters.search.length >= 2 ? (
                        <>
                          <p className="text-lg font-medium">No users found</p>
                          <p>No users match your search "{filters.search}"</p>
                        </>
                      ) : filters.search && filters.search.length < 2 ? (
                        <>
                          <p className="text-lg font-medium">Type to search</p>
                          <p>Enter at least 2 characters to search users</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium">No users found</p>
                          <p>Check your permissions or try refreshing</p>
                        </>
                      )}
                    </div>
                    {filters.search && (
                      <Button
                        variant="outline"
                        onClick={() => handleFilterChange({ search: '' })}
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default UsersComponent;