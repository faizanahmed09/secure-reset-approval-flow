// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithDbUser,
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
    // Authenticate the request - admins can update users
    const { dbUser } = await authenticateRequestWithDbUser(req);
    requireRole(dbUser, ['admin']);

    const body = await req.json();
    const { userId, is_active, role } = body;

    if (!userId) {
      return createErrorResponse("User ID is required", 400);
    }

    // Validate role if provided
    if (role && !['admin', 'verifier', 'basic'].includes(role)) {
      return createErrorResponse("Invalid role. Must be admin, verifier, or basic", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse("Server configuration error", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, get the user to check they belong to the same organization
    const { data: targetUser, error: fetchError } = await supabase
      .from("azure_users")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return createErrorResponse("User not found", 404);
    }

    // Verify the admin user belongs to the same organization as the target user
    requireOrganization(dbUser, targetUser.organization_id);

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (typeof is_active === 'boolean') {
      updateData.is_active = is_active;
    }

    if (role) {
      updateData.role = role;
    }

    // Update user
    const { data: updatedUser, error } = await supabase
      .from("azure_users")
      .update(updateData)
      .eq("id", userId)
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
      .single();

    if (error) {
      console.error("Error updating user:", error);
      return createErrorResponse("Failed to update user", 500);
    }

    return createSuccessResponse({
      user: updatedUser,
      message: "User updated successfully"
    });

  } catch (error) {
    console.error("Error processing request:", error);
    
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
