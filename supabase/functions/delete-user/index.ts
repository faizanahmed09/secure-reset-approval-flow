// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authenticateRequestWithDbUser,
  requireRole,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

console.log("Delete user function script started");

// Main function to handle user deletion requests
async function deleteUser(req) {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    // Authenticate the request - only admins can delete users
    const { dbUser } = await authenticateRequestWithDbUser(req);
    requireRole(dbUser, ['admin']);

    // Extract parameters from the request body
    const { userId } = await req.json();
    
    if (!userId) {
      return createErrorResponse("User ID is required", 400);
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '', 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // Get target user info and verify they belong to the same organization
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('azure_users')
      .select('id, email, organization_id')
      .eq('id', userId)
      .single();

    if (targetUserError || !targetUser) {
      return createErrorResponse("Target user not found", 404);
    }

    // Verify the admin belongs to the same organization as the target user
    if (dbUser.organization_id !== targetUser.organization_id) {
      return createErrorResponse(
        "You can only delete users from your own organization",
        403
      );
    }

    // Prevent admin from deleting themselves
    if (targetUser.email === dbUser.email) {
      return createErrorResponse(
        "Admins cannot delete their own accounts",
        400
      );
    }

    // Proceed with deletion
    const { error: deleteError } = await supabaseAdmin
      .from('azure_users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error("Database error during deletion:", deleteError);
      return createErrorResponse(
        `Database error: ${deleteError.message}`,
        500
      );
    }

    // Return success response
    return createSuccessResponse(
      { deletedUserId: userId },
      "User deleted successfully"
    );

  } catch (error) {
    console.error("Authentication or processing error:", error);
    
    // Handle authentication errors specifically
    if (error.message.includes('Authorization header') || 
        error.message.includes('Token') ||
        error.message.includes('User not found') ||
        error.message.includes('permissions')) {
      return createErrorResponse(error.message, 401);
    }

    return createErrorResponse(
      error.message || "An internal server error occurred",
      500
    );
  }
}

// Listen for incoming fetch events
Deno.serve(deleteUser);
