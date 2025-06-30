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

// Helper function to create organization name from domain
function createOrganizationName(domain: string): string {
  const baseName = domain.split(".")[0];
  return baseName.charAt(0).toUpperCase() + baseName.slice(1);
}

// Helper function to check and manage MFA secret for organization
async function checkAndManageMfaSecret(tenantId: string, clientId: string, accessToken: string, userEmail: string, organizationId: string, isNewOrganization: boolean) {
  try {
    if (isNewOrganization) {
      console.log("Generating MFA secret for new organization:", organizationId);
      return await generateMfaSecret(tenantId, clientId, accessToken, userEmail, organizationId, "new organization");
    }
    
    // For existing organizations, check if MFA secret exists and is valid
    console.log("Checking MFA secret status for existing organization:", organizationId);
    
    const checkResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/check-mfa-secret`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          organizationId: organizationId,
        }),
      }
    );
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      
      // If no valid secret exists or it's expiring soon, generate a new one
      if (!checkData.exists || checkData.isExpiringSoon) {
        const reason = !checkData.exists ? "missing" : "expiring soon";
        console.log(`MFA secret ${reason} for organization ${organizationId}, generating new secret`);
        return await generateMfaSecret(tenantId, clientId, accessToken, userEmail, organizationId, reason);
      } else {
        console.log("Valid MFA secret already exists for organization:", organizationId);
        return { generated: false, reason: "already_exists" };
      }
    } else {
      console.error("Failed to check MFA secret status");
      return { generated: false, error: "check_failed" };
    }
  } catch (error) {
    console.error("Error in checkAndManageMfaSecret:", error);
    return { generated: false, error: error.message };
  }
}

// Helper function to generate MFA secret
async function generateMfaSecret(tenantId: string, clientId: string, accessToken: string, userEmail: string, organizationId: string, reason: string) {
  try {
    const generateResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-mfa-secret`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: tenantId,
          clientId: clientId,
          accessToken: accessToken,
          organizationId: organizationId,
          userDetails: {
            email: userEmail
          }
        }),
      }
    );
    
    if (generateResponse.ok) {
      const generateData = await generateResponse.json();
      console.log(`MFA secret generated successfully for ${reason}:`, generateData.secretId);
      return { generated: true, secretId: generateData.secretId, reason };
    } else {
      const error = await generateResponse.json();
      console.error(`Failed to generate MFA secret for ${reason}:`, error);
      return { generated: false, error: error.message };
    }
  } catch (error) {
    console.error(`Error generating MFA secret for ${reason}:`, error);
    return { generated: false, error: error.message };
  }
}

// Helper function to create or get organization based on email domain
async function createOrGetOrganization(
  supabase: any,
  email: string,
  tenantId: string,
  clientId: string
) {
  const domain = extractDomainFromEmail(email);
  console.log("Processing organization for domain:", domain);

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

  // Organization doesn't exist, create new one based on email domain
  const organizationName = createOrganizationName(domain);
  const newOrganization = {
    name: organizationName.toLowerCase(),
    domain: domain,
    display_name: organizationName,
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
    const { userInfo } = body; // Removed organizationDetails as it's no longer needed

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

    // Create or get organization based on email domain
    let organization;
    try {
      organization = await createOrGetOrganization(
        supabase,
        userInfo.email,
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
        // Return existing user data if update fails
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

      // Check and manage MFA secret for existing admin users
      if (userInfo.accessToken && existingUser.role === "admin") {
        console.log("Checking MFA secret for existing admin user:", userInfo.email);
        const mfaResult = await checkAndManageMfaSecret(
          userInfo.tenantId,
          userInfo.clientId,
          userInfo.accessToken,
          userInfo.email,
          organization.id,
          false // not a new organization
        );
        
        if (mfaResult.generated) {
          console.log(`MFA secret generated for existing admin (${mfaResult.reason})`);
        } else if (mfaResult.error) {
          console.warn("MFA secret management failed for existing admin:", mfaResult.error);
        }
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

    // Check and manage MFA secret for admin users (new organization or existing)
    if (userInfo.accessToken && userRole === "admin") {
      console.log("Checking MFA secret for admin user:", userInfo.email);
      const mfaResult = await checkAndManageMfaSecret(
        userInfo.tenantId,
        userInfo.clientId,
        userInfo.accessToken,
        userInfo.email,
        organization.id,
        !hasAdmin // true if this is a new organization (no existing admin)
      );
      
      if (mfaResult.generated) {
        console.log(`MFA secret generated for admin (${mfaResult.reason})`);
      } else if (mfaResult.error) {
        console.warn("MFA secret management failed for admin:", mfaResult.error);
      }
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
