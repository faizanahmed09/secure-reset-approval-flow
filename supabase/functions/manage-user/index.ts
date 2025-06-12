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
    const { userInfo } = body;
    if (!userInfo || !userInfo.email) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing user information"
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
    // Check if user exists - use data instead of single() to avoid errors
    const { data: existingUsers, error: fetchError } = await supabase.from("azure_users").select("*").eq("email", userInfo.email);
    if (fetchError) {
      console.error("Error checking user:", fetchError);
      return new Response(JSON.stringify({
        success: false,
        message: "Database error"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const existingUser = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;
    console.log("Existing user:", existingUser);
    if (existingUser) {
      console.log(existingUser, 'existing user found - logging in');
      // User exists - update last login and return user info
      const { data: updatedUser, error: updateError } = await supabase.from("azure_users").update({
        last_login_at: new Date().toISOString(),
        tenant_id: userInfo.tenantId || existingUser.tenant_id
      }).eq("id", existingUser.id).select().single();
      if (updateError) {
        console.error("Error updating user:", updateError);
        // Return existing user even if update fails
        return new Response(JSON.stringify({
          success: true,
          action: "login",
          user: existingUser,
          message: "User logged in successfully"
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        action: "login",
        user: updatedUser,
        message: "User logged in successfully"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    } else {
      console.log('No existing user found - creating new user');
      const newUser = {
        email: userInfo.email,
        tenant_id: userInfo.tenantId || "",
        client_id: userInfo.clientId || "",
        token: userInfo.token || "",
        object_id: userInfo.objectId || "",
        token_expires_at: userInfo.tokenExpiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        is_active: true
      };
      const { data: createdUser, error: createError } = await supabase.from("azure_users").insert(newUser).select().single();
      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({
          success: false,
          message: "Failed to create user"
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
        action: "signup",
        user: createdUser,
        message: "User created successfully"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  } catch (error) {
    console.error("Error in user management:", error);
    return new Response(JSON.stringify({
      success: false,
      message: "Server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
