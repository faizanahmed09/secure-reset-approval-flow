const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lbyvutzdimidlzgbjstz.supabase.co";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const idToken = window.sessionStorage.getItem('idToken');
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
  }

  return headers;
};

interface Organization {
  id: string;
  name: string;
  domain: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpdateOrganizationRequest {
  organizationId: string;
  organizationName: string;
  userEmail: string;
}

interface UpdateOrganizationResponse {
  success: boolean;
  organization?: Organization;
  message: string;
}

export const organizationService = {
  // Update organization details
  updateOrganization: async (request: UpdateOrganizationRequest): Promise<UpdateOrganizationResponse> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/update-organization`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Failed to update organization: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to update organization');
      }

      return data;
    } catch (error: any) {
      console.error("Error updating organization:", error);
      return {
        success: false,
        message: error.message || "Failed to update organization",
      };
    }
  },
}; 