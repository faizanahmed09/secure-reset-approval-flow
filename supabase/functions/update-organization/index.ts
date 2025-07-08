// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { 
  authenticateRequestFast,
  requireRole,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    // Authenticate user with fast authentication
    const authResult = await authenticateRequestFast(req);
    const { user, dbUser } = authResult;

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Require admin role for organization updates
    try {
      requireRole(dbUser, ['admin']);
    } catch (roleError) {
      return createErrorResponse(roleError.message, 403);
    }

    const { organizationId, organizationName } = await req.json();

    if (!organizationId || !organizationName) {
      return createErrorResponse("Missing required fields: organizationId, organizationName", 400);
    }

    // Ensure user can only update their own organization
    if (dbUser.organization_id !== organizationId) {
      return createErrorResponse("Access denied: Cannot update other organization", 403);
    }

    // Update organization
    const { data: updatedOrganization, error: updateError } = await supabase
      .from("organizations")
      .update({
        name: organizationName.toLowerCase().trim(),
        display_name: organizationName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq("id", organizationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating organization:", updateError);
      return createErrorResponse("Failed to update organization", 500);
    }

    return createSuccessResponse({
      organization: updatedOrganization,
      message: "Organization updated successfully"
    });

  } catch (error) {
    console.error("Error processing request:", error);
    return createErrorResponse("Internal server error", 500);
  }
});
