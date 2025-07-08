// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  authenticateRequestWithDbUser,
  requireRole,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse 
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPrelight();
  }

  try {
    // Authenticate the request and get user info
    const { dbUser } = await authenticateRequestWithDbUser(req);
    
    // Only admins can create users
    requireRole(dbUser, ['admin']);

    const body = await req.json();
    const { azureUser, role, organizationId, tenantId, clientId } = body;

    if (!azureUser || !role || !organizationId || !tenantId || !clientId) {
      return createErrorResponse(
        "Missing required fields: azureUser, role, organizationId, tenantId, clientId",
        400
      );
    }

    // Validate role
    if (!['admin', 'verifier', 'basic'].includes(role)) {
      return createErrorResponse(
        "Invalid role. Must be admin, verifier, or basic",
        400
      );
    }

    // Verify the admin belongs to the organization they're trying to create a user for
    if (dbUser.organization_id !== organizationId) {
      return createErrorResponse(
        "You can only create users in your own organization",
        403
      );
    }

    // Verify tenant matches the authenticated user's tenant
    if (dbUser.tenant_id !== tenantId) {
      return createErrorResponse(
        "Tenant ID mismatch",
        403
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse("Server configuration error", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("azure_users")
      .select("id, email")
      .eq("email", azureUser.userPrincipalName)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking existing user:", checkError);
      return createErrorResponse("Database error while checking existing user", 500);
    }

    if (existingUser) {
      return createErrorResponse("User already exists in the database", 409);
    }

    // Create new user
    const newUser = {
      email: azureUser.userPrincipalName,
      name: azureUser.displayName,
      tenant_id: tenantId,
      client_id: clientId,
      object_id: azureUser.id,
      organization_id: organizationId,
      role: role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null
    };

    const { data: createdUser, error: createError } = await supabase
      .from("azure_users")
      .insert(newUser)
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

    if (createError) {
      console.error("Error creating user:", createError);
      return createErrorResponse("Failed to create user in database", 500);
    }

    return createSuccessResponse(
      { user: createdUser },
      "User created successfully"
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

    return createErrorResponse("Internal server error", 500);
  }
});
