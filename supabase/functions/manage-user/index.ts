// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper function to extract domain from email
function extractDomainFromEmail(email: string): string {
  const domain = email.split("@")[1];
  return domain ? domain.toLowerCase() : "";
}

// Helper function to create or get organization
async function createOrGetOrganization(
  supabase: any,
  email: string,
  organizationDetails: any,
  tenantId: string,
  clientId: string
) {
  const domain = extractDomainFromEmail(email);
  console.log("Organization:", organizationDetails);

  if (!domain) {
    throw new Error("Invalid email domain");
  }

  // First, try to find existing organization by domain
  const { data: existingOrg, error: fetchOrgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("domain", domain)
    .single();

  if (fetchOrgError && fetchOrgError.code !== "PGRST116") {
    // PGRST116 = no rows found
    console.error("Error fetching organization:", fetchOrgError);
    throw new Error("Database error while fetching organization");
  }

  if (existingOrg) {
    console.log("Found existing organization:", existingOrg);
    return existingOrg;
  }

  // Organization doesn't exist, create new one using Microsoft Graph API details
  const newOrganization = {
    name:
      organizationDetails?.defaultDomainName?.split(".")[0] ||
      domain.split(".")[0],
    domain: organizationDetails?.defaultDomainName || domain,
    display_name:
      organizationDetails?.displayName ||
      domain.split(".")[0].charAt(0).toUpperCase() +
        domain.split(".")[0].slice(1),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: createdOrg, error: createOrgError } = await supabase
    .from("organizations")
    .insert(newOrganization)
    .select()
    .single();

  if (createOrgError) {
    console.error("Error creating organization:", createOrgError);
    throw new Error("Failed to create organization");
  }

  console.log("Created new organization:", createdOrg);

  // Create organization configuration
  const { error: configError } = await supabase
    .from("organization_configuration")
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      organization_id: createdOrg.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (configError) {
    console.error("Error creating organization configuration:", configError);
    // Don't throw error here as the organization was created successfully
  }

  return createdOrg;
}

// Helper function to find organization by tenant ID
async function findOrganizationByTenantId(supabase: any, tenantId: string) {
  const { data: orgConfig, error: configError } = await supabase
    .from("organization_configuration")
    .select("organization_id")
    .eq("tenant_id", tenantId)
    .single();

  if (configError) {
    console.error("Error finding organization by tenant ID:", configError);
    return null;
  }

  if (!orgConfig) {
    return null;
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgConfig.organization_id)
    .single();

  if (orgError) {
    console.error("Error fetching organization:", orgError);
    return null;
  }

  return organization;
}

// Helper function to check if organization has any admin users
async function hasAdminUsers(supabase: any, organizationId: string) {
  const { data: adminUsers, error } = await supabase
    .from("azure_users")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .limit(1);

  if (error) {
    console.error("Error checking for admin users:", error);
    return false;
  }

  return adminUsers && adminUsers.length > 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const { userInfo, organizationDetails } = body;

    if (!userInfo || !userInfo.email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing user information",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Server configuration error",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find existing organization by tenant ID
    let organization = await findOrganizationByTenantId(
      supabase,
      userInfo.tenantId
    );

    // If organization doesn't exist, create new one
    if (!organization) {
      try {
        organization = await createOrGetOrganization(
          supabase,
          userInfo.email,
          organizationDetails,
          userInfo.tenantId,
          userInfo.clientId
        );
      } catch (orgError) {
        console.error("Organization error:", orgError);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Failed to process organization",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // Check if user exists
    const { data: existingUsers, error: fetchError } = await supabase
      .from("azure_users")
      .select("*, organizations(*)")
      .eq("email", userInfo.email);

    if (fetchError) {
      console.error("Error checking user:", fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Database error",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const existingUser =
      existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

    if (existingUser) {
      // User exists - update last login and organization if needed
      const updateData: any = {
        last_login_at: new Date().toISOString(),
        tenant_id: userInfo.tenantId || existingUser.tenant_id,
        updated_at: new Date().toISOString(),
      };

      // Update organization_id if it's different or null
      if (
        !existingUser.organization_id ||
        existingUser.organization_id !== organization.id
      ) {
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
        return new Response(
          JSON.stringify({
            success: true,
            action: "login",
            user: { ...existingUser, organization },
            message: "User logged in successfully",
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "login",
          user: updatedUser,
          message: "User logged in successfully",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Check if this is the first user for the organization
    const hasAdmin = await hasAdminUsers(supabase, organization.id);
    const userRole = hasAdmin ? "basic" : "admin";

    // Create new user
    const newUser = {
      email: userInfo.email,
      name: userInfo.name || "",
      tenant_id: userInfo.tenantId,
      client_id: userInfo.clientId,
      token: userInfo.token || null,
      object_id: userInfo.objectId,
      token_expires_at: userInfo.tokenExpiresAt,
      organization_id: organization.id,
      role: userRole,
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
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to create user",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "signup",
        user: createdUser,
        message: "User created successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
