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
    const { userId, is_active, role } = body;
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        message: "User ID is required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Validate role if provided
    if (role && ![
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
    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    };
    if (typeof is_active === 'boolean') {
      updateData.is_active = is_active;
    }
    if (role) {
      updateData.role = role;
    }
    // Update user
    const { data: updatedUser, error } = await supabase.from("azure_users").update(updateData).eq("id", userId).select(`
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
    if (error) {
      console.error("Error updating user:", error);
      return new Response(JSON.stringify({
        success: false,
        message: "Failed to update user"
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
      user: updatedUser,
      message: "User updated successfully"
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
