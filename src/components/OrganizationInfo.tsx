'use client';

import React from 'react';
import { Building2, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Organization {
  id: string;
  name: string;
  domain: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OrganizationInfoProps {
  organization: Organization;
  showDetails?: boolean;
  className?: string;
}

export const OrganizationInfo: React.FC<OrganizationInfoProps> = ({ 
  organization, 
  showDetails = false,
  className = ""
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!showDetails) {
    // Simple inline display
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{organization.display_name}</span>
        {/* <Badge variant="secondary" className="text-xs">
          {organization.domain}
        </Badge> */}
      </div>
    );
  }

  // Detailed card display
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          {organization.display_name}
        </CardTitle>
        <CardDescription>
          Organization details and information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Domain</label>
            <p className="text-sm">{organization.domain}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <p className="text-sm">{organization.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Created {formatDate(organization.created_at)}
            </span>
          </div>
          <Badge variant={organization.is_active ? "default" : "secondary"}>
            {organization.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

// Simple organization badge component
export const OrganizationBadge: React.FC<{ organization: Organization }> = ({ organization }) => {
  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Building2 className="h-3 w-3" />
      {organization.display_name}
    </Badge>
  );
};

export default OrganizationInfo; 