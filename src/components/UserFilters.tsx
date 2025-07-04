'use client';
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2 } from "lucide-react";

export type SortField = 'displayName' | 'userPrincipalName' | 'mail';
export type SortOrder = 'asc' | 'desc';

export interface UserFilterOptions {
  search: string;
  sortBy: SortField;
  sortOrder: SortOrder;
}

interface UserFiltersProps {
  filters: UserFilterOptions;
  onFilterChange: (filters: Partial<UserFilterOptions>) => void;
  searchLoading: boolean;
}

const UserFilters = ({
  filters,
  onFilterChange,
  searchLoading,
}: UserFiltersProps) => {

  const sortOptions = [
    { value: "displayName", label: "Display Name" },
    { value: "userPrincipalName", label: "Email" },
    { value: "mail", label: "Alternate Email" }
  ];

  const handleSortByChange = (value: SortField) => {
    onFilterChange({ sortBy: value, sortOrder: 'asc' });
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                className="pl-10"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Select
              value={filters.sortBy}
              onValueChange={handleSortByChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.sortOrder}
              onValueChange={(value: SortOrder) => onFilterChange({ sortOrder: value })}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserFilters; 