// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPrelight();
  }

  try {
    // This is an internal service function - called by manage-user which handles authorization
    const { organizationId } = await req.json();
    if (!organizationId) {
      return createErrorResponse("Missing required parameter: organizationId", 400);
    }

    // Create Supabase client with service role key for internal access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse("Server configuration error: Missing Supabase credentials", 500);
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the most recent active secret for this organization
    const { data, error } = await supabase
      .from("mfa_secrets")
      .select("expires_at, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Database error when checking for MFA secret:", error);
      return createErrorResponse("Database error when checking for MFA secret", 500);
    }

    // Check if we found a secret
    if (!data || data.length === 0) {
      return createSuccessResponse({
        exists: false,
        message: "No valid MFA secret found for this organization"
      });
    }

    const secret = data[0];
    
    // Check if the secret is expiring soon (within 30 days)
    const expiresAt = new Date(secret.expires_at);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const isExpiringSoon = expiresAt < thirtyDaysFromNow;
    
    return createSuccessResponse({
      exists: true,
      isExpiringSoon,
      expiresAt: expiresAt.toISOString(),
      message: isExpiringSoon ? "MFA secret exists but will expire soon" : "Valid MFA secret found"
    });

  } catch (error) {
    console.error("Error checking MFA secret:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});
