'use client';
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Card,
  CardContent
} from "@/components/ui/card";
import { FilterOptions } from "@/app/change-requests-log/page";
import { Search } from "lucide-react";

interface ChangeRequestFiltersProps {
  filters: FilterOptions;
  onFilterChange: (filters: Partial<FilterOptions>) => void;
}

const ChangeRequestFilters = ({
  filters,
  onFilterChange
}: ChangeRequestFiltersProps) => {
  // Status options for the select dropdown
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "denied", label: "Denied" },
    { value: "timeout", label: "Timeout" },
    { value: "error", label: "Error" },
    { value: "user_not_found", label: "User Not Found" }
  ];

  // Sort options for the select dropdown
  const sortOptions = [
    { value: "created_at", label: "Created Date" },
    { value: "completed_at", label: "Completed Date" },
    { value: "status", label: "Status" },
    { value: "user_email", label: "User Email" }
  ];

  // Handle status filter change, mapping 'all' to empty string for the backend
  const handleStatusChange = (value: string) => {
    onFilterChange({ status: value === "all" ? "" : value });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={filters.search}
              onChange={(e) => onFilterChange({ search: e.target.value })}
              className="pl-10"
            />
          </div>

          {/* Status filter */}
          <Select
            value={filters.status === "" ? "all" : filters.status}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort filter */}
          <div className="flex gap-2">
            <Select
              value={filters.sortBy}
              onValueChange={(value) => onFilterChange({ sortBy: value })}
            >
              <SelectTrigger>
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
              onValueChange={(value: "asc" | "desc") => onFilterChange({ sortOrder: value })}
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

export default ChangeRequestFilters;
