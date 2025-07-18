// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestFast,
  requireRole,
  requireOrganization,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPrelight();
  }

  try {
    // OPTIMIZED: Use fast authentication without organization JOIN
    const { dbUser } = await authenticateRequestFast(req);
    requireRole(dbUser, ['admin', 'verifier']);

    const body = await req.json();
    const { organizationId } = body;

    if (!organizationId) {
      return createErrorResponse("Organization ID is required", 400);
    }

    // Verify the user belongs to the organization they're requesting data for
    requireOrganization(dbUser, organizationId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse("Server configuration error", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch users for the organization
    const { data: users, error } = await supabase
      .from("azure_users")
      .select(`
        id,
        email,
        name,
        tenant_id,
        last_login_at,
        is_active,
        role,
        organizations (
          display_name
        )
      `)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching users:", error);
      return createErrorResponse("Failed to fetch users", 500);
    }

    return createSuccessResponse({
      users: users || []
    });

  } catch (error) {
    console.error("Error in get-users function:", error);
    
    // Handle authentication errors specifically
    if (error.message.includes('Authorization header') || 
        error.message.includes('Token') ||
        error.message.includes('User not found') ||
        error.message.includes('permissions')) {
      
      return createErrorResponse(error.message, 401);
    }

    return createErrorResponse("Internal server error", 500);
  }
});
