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
    const { organizationId } = await req.json();
    if (!organizationId) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required parameter: organizationId"
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
    // Get the most recent active secret for this organization
    const { data, error } = await supabase
      .from("mfa_secrets")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false
      })
      .limit(1);
    if (error) {
      return new Response(JSON.stringify({
        success: false,
        message: "Database error when checking for MFA secret"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log("MFA secret check result:", data);
    // Check if we found a secret
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        exists: false,
        message: "No valid MFA secret found for this organization"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const secret = data[0];
    // Check if the secret is expiring soon (within 30 days)
    const expiresAt = new Date(secret.expires_at);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const isExpiringSoon = expiresAt < thirtyDaysFromNow;
    
    return new Response(JSON.stringify({
      success: true,
      exists: true,
      isExpiringSoon,
      expiresAt: expiresAt.toISOString(),
      message: isExpiringSoon ? "MFA secret exists but will expire soon" : "Valid MFA secret found"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error checking MFA secret:", error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
