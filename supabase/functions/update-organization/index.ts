// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const { organizationId, organizationName, userEmail } = body;

    if (!organizationId || !organizationName || !userEmail) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing required fields: organizationId, organizationName, userEmail"
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

    // Verify user has permission to update organization (must be admin of this organization)
    const { data: user, error: userError } = await supabase
      .from("azure_users")
      .select("id, role, organization_id")
      .eq("email", userEmail)
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        message: "Unauthorized: Only organization admins can update organization details"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
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
      return new Response(JSON.stringify({
        success: false,
        message: "Failed to update organization"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // Call the dedicated create-trial-subscription function
    try {
      console.log(`Calling create-trial-subscription for organization ${organizationId}`);
      
      const trialResponse = await fetch(`${supabaseUrl}/functions/v1/create-trial-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ organizationId }),
      });

      const trialResult = await trialResponse.json();
      
      if (trialResult.success) {
        console.log(`Successfully created trial subscription for organization ${organizationId}`);
      } else {
        console.log(`Trial creation skipped for organization ${organizationId}: ${trialResult.error}`);
        // This is fine - organization might already have a subscription
      }
    } catch (trialError) {
      console.error("Error calling create-trial-subscription:", trialError);
      // Don't fail the organization update if trial creation fails
      // Just log the error and continue
    }

    return new Response(JSON.stringify({
      success: true,
      organization: updatedOrganization,
      message: "Organization updated successfully"
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
