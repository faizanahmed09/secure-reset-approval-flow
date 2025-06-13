// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// Helper function to extract domain from email
function extractDomainFromEmail(email: string): string {
  const domain = email.split('@')[1];
  return domain ? domain.toLowerCase() : '';
}

// Helper function to generate organization name from domain
function generateOrgNameFromDomain(domain: string): string {
  // Remove common TLDs and get the main part
  const mainPart = domain.split('.')[0];
  return mainPart.toLowerCase();
}

// Helper function to create or get organization
async function createOrGetOrganization(supabase: any, email: string) {
  const domain = extractDomainFromEmail(email);
  
  if (!domain) {
    throw new Error('Invalid email domain');
  }

  // First, try to find existing organization by domain
  const { data: existingOrg, error: fetchOrgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("domain", domain)
    .single();

  if (fetchOrgError && fetchOrgError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error("Error fetching organization:", fetchOrgError);
    throw new Error('Database error while fetching organization');
  }

  if (existingOrg) {
    console.log("Found existing organization:", existingOrg);
    return existingOrg;
  }

  // Organization doesn't exist, create new one
  const orgName = generateOrgNameFromDomain(domain);
  const displayName = orgName.charAt(0).toUpperCase() + orgName.slice(1); // Capitalize first letter

  const newOrganization = {
    name: orgName,
    domain: domain,
    display_name: displayName,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: createdOrg, error: createOrgError } = await supabase
    .from("organizations")
    .insert(newOrganization)
    .select()
    .single();

  if (createOrgError) {
    console.error("Error creating organization:", createOrgError);
    throw new Error('Failed to create organization');
  }

  console.log("Created new organization:", createdOrg);
  return createdOrg;
}

serve(async (req) => {
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

    // Create or get organization first
    let organization;
    try {
      organization = await createOrGetOrganization(supabase, userInfo.email);
    } catch (orgError) {
      console.error("Organization error:", orgError);
      return new Response(JSON.stringify({
        success: false,
        message: "Failed to process organization"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }

    // Check if user exists - use data instead of single() to avoid errors
    const { data: existingUsers, error: fetchError } = await supabase
      .from("azure_users")
      .select("*, organizations(*)")
      .eq("email", userInfo.email);

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
      
      // User exists - update last login and organization if needed
      const updateData: any = {
        last_login_at: new Date().toISOString(),
        tenant_id: userInfo.tenantId || existingUser.tenant_id,
        updated_at: new Date().toISOString()
      };

      // Update organization_id if it's different or null
      if (!existingUser.organization_id || existingUser.organization_id !== organization.id) {
        updateData.organization_id = organization.id;
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from("azure_users")
        .update(updateData)
        .eq("id", existingUser.id)
        .select("*, organizations(*)")
        .single();

      if (updateError) {
        console.error("Error updating user:", updateError);
        // Return existing user even if update fails
        return new Response(JSON.stringify({
          success: true,
          action: "login",
          user: { ...existingUser, organization },
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
        organization_id: organization.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
        is_active: true
      };

      const { data: createdUser, error: createError } = await supabase
        .from("azure_users")
        .insert(newUser)
        .select("*, organizations(*)")
        .single();

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
