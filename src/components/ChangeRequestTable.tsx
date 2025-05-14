
import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChangeRequest, FilterOptions } from "@/pages/ChangeRequestsLog";

interface ChangeRequestTableProps {
  changeRequests: ChangeRequest[];
  isLoading: boolean;
  filters: FilterOptions;
  totalPages: number;
  onFilterChange: (filters: Partial<FilterOptions>) => void;
}

const ChangeRequestTable = ({
  changeRequests,
  isLoading,
  filters,
  totalPages,
  onFilterChange,
}: ChangeRequestTableProps) => {
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return format(new Date(dateString), "MMM dd, yyyy HH:mm:ss");
  };

  // Return status badge with appropriate color
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, { className: string }> = {
      pending: { className: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
      approved: { className: "bg-green-100 text-green-800 hover:bg-green-200" },
      denied: { className: "bg-red-100 text-red-800 hover:bg-red-200" },
      timeout: { className: "bg-orange-100 text-orange-800 hover:bg-orange-200" },
      error: { className: "bg-red-100 text-red-800 hover:bg-red-200" },
      user_not_found: { className: "bg-gray-100 text-gray-800 hover:bg-gray-200" },
    };

    const style = statusColors[status] || { className: "bg-gray-100 text-gray-800 hover:bg-gray-200" };

    return (
      <Badge className={style.className} variant="outline">
        {status.replace("_", " ")}
      </Badge>
    );
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    onFilterChange({ page: newPage });
  };

  // Generate pagination items
  const generatePaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5; // Maximum number of page links to show
    
    // Calculate range of pages to show
    let startPage = Math.max(1, filters.page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add page links
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={i === filters.page}
            onClick={() => handlePageChange(i)}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  };

  // Show detailed view of a change request
  const showDetailView = (request: ChangeRequest) => {
    setSelectedRequest(request);
  };

  // Generate table rows or loading skeletons
  const renderTableContent = () => {
    if (isLoading) {
      return Array(filters.pageSize).fill(0).map((_, index) => (
        <TableRow key={`loading-${index}`}>
          {Array(6).fill(0).map((_, colIndex) => (
            <TableCell key={`loading-cell-${index}-${colIndex}`}>
              <Skeleton className="h-6 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ));
    }

    if (changeRequests.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="h-32 text-center">
            No change requests found.
          </TableCell>
        </TableRow>
      );
    }

    return changeRequests.map((request) => (
      <TableRow
        key={request.id}
        className={
          request.notification_sent 
            ? "bg-blue-50 hover:bg-blue-100" 
            : "hover:bg-muted/50"
        }
      >
        <TableCell className="font-medium">{request.user_email}</TableCell>
        <TableCell>
          {getStatusBadge(request.status)}
          <div className="text-xs text-muted-foreground mt-1">
            {formatDate(request.updated_at)}
          </div>
        </TableCell>
        <TableCell>
          {request.notification_sent ? (
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              Sent
            </Badge>
          ) : (
            "No"
          )}
        </TableCell>
        <TableCell>{formatDate(request.created_at)}</TableCell>
        <TableCell>{request.admin_name}</TableCell>
        <TableCell>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => showDetailView(request)}
          >
            View Details
          </Button>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notification</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderTableContent()}
        </TableBody>
      </Table>

      {/* Pagination */}
      {!isLoading && changeRequests.length > 0 && (
        <div className="py-4 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(filters.page - 1)}
                  className={filters.page === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              
              {generatePaginationItems()}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(filters.page + 1)}
                  className={filters.page === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Change Request Details</DialogTitle>
            <DialogDescription>
              Complete information about this change request
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Request ID</h3>
                  <p className="text-sm font-mono">{selectedRequest.id}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">User Email</h3>
                  <p className="text-sm">{selectedRequest.user_email}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Notification Sent</h3>
                  <p className="text-sm">{selectedRequest.notification_sent ? "Yes" : "No"}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Context ID</h3>
                  <p className="text-sm font-mono">{selectedRequest.context_id || "—"}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Tenant ID</h3>
                  <p className="text-sm font-mono">{selectedRequest.tenant_id || "—"}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Created At</h3>
                  <p className="text-sm">{formatDate(selectedRequest.created_at)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Updated At</h3>
                  <p className="text-sm">{formatDate(selectedRequest.updated_at)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Completed At</h3>
                  <p className="text-sm">{formatDate(selectedRequest.completed_at)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Admin Name</h3>
                  <p className="text-sm">{selectedRequest.admin_name || "—"}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Admin Email</h3>
                  <p className="text-sm">{selectedRequest.admin_email || "—"}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Admin Object ID</h3>
                  <p className="text-sm font-mono">{selectedRequest.admin_object_id || "—"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChangeRequestTable;
