// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    const { azureUser, role, organizationId, tenantId, clientId } = body;
    if (!azureUser || !role || !organizationId || !tenantId || !clientId) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required fields: azureUser, role, organizationId, tenantId, clientId"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate role
    if (![
      'admin',
      'verifier',
      'basic'
    ].includes(role)) {
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid role. Must be admin, verifier, or basic"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({
        success: false,
        message: "Server configuration error"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase.from("azure_users").select("id, email").eq("email", azureUser.userPrincipalName).single();
    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking existing user:", checkError);
      return new Response(JSON.stringify({
        success: false,
        message: "Database error while checking existing user"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        message: "User already exists in the database"
      }), {
        status: 409,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
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
    const { data: createdUser, error: createError } = await supabase.from("azure_users").insert(newUser).select(`
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
      `).single();
    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(JSON.stringify({
        success: false,
        message: "Failed to create user in database"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      user: createdUser,
      message: "User created successfully"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({
      success: false,
      message: "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
