import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Skeleton for subscription overview section
export const SubscriptionOverviewSkeleton = () => (
  <Card className="mb-6">
    <CardHeader className="flex flex-row items-start justify-between">
      <div>
        <Skeleton className="h-6 w-48 mb-2" />
      </div>
      <Skeleton className="h-9 w-44" />
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton className="h-8 w-12 mx-auto mb-1" />
            <Skeleton className="h-4 w-24 mx-auto mb-1" />
            {i === 1 && <Skeleton className="h-3 w-20 mx-auto" />}
            {i === 3 && <Skeleton className="h-6 w-16 mx-auto mt-2" />}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Skeleton for trial information card
export const TrialInfoSkeleton = () => (
  <Card className="mb-6 border-blue-200 bg-blue-50">
    <CardHeader>
      <Skeleton className="h-6 w-36" />
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton className="h-8 w-16 mx-auto mb-1" />
            <Skeleton className="h-4 w-24 mx-auto mb-1" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 bg-blue-100 border border-blue-200 rounded-md">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="mt-3 pt-2 border-t border-blue-200">
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Skeleton for canceled subscription warning
export const SubscriptionWarningSkeleton = () => (
  <Card className="mb-6 border-orange-200 bg-orange-50">
    <CardHeader>
      <Skeleton className="h-6 w-48" />
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <div className="bg-orange-100 p-3 rounded-md">
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Skeleton for users table
export const UsersTableSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-4 w-12" /></TableHead>
              <TableHead><Skeleton className="h-4 w-20" /></TableHead>
              <TableHead><Skeleton className="h-4 w-8" /></TableHead>
              <TableHead><Skeleton className="h-4 w-12" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              <TableHead><Skeleton className="h-4 w-14" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

// Skeleton for organization information card
export const OrganizationInfoSkeleton = () => (
  <Card className="mt-6">
    <CardHeader>
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        <div>
          <Skeleton className="h-4 w-32 mb-2" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
); 