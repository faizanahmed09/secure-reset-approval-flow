const SUPABASE_URL = "https://lbyvutzdimidlzgbjstz.supabase.co";

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error updating organization:", error);
      return {
        success: false,
        message: "Failed to update organization",
      };
    }
  },
}; 