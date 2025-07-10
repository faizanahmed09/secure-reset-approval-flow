// @ts-nocheck
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  authenticateRequestTokenOnly,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

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

// Helper function to check if MFA service principal exists in tenant
async function checkMfaServicePrincipalExists(accessToken: string): Promise<boolean> {
  try {
    const mfaAppId = Deno.env.get("MFA_CLIENT_ID") || "";
    
    const spResponse = await fetch(`https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${mfaAppId}'`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!spResponse.ok) {
      console.warn("Failed to check service principal existence:", spResponse.status);
      return false;
    }
    
    const spData = await spResponse.json();
    return spData.value && spData.value.length > 0;
  } catch (error) {
    console.warn("Error checking service principal existence:", error);
    return false;
  }
}



// Helper function to check and manage MFA secret for organization
async function checkAndManageMfaSecret(tenantId: string, clientId: string, accessToken: string, userEmail: string, organizationId: string, isNewOrganization: boolean) {
  try {
    // First, check if the MFA service principal exists in the tenant
    const servicePrincipalExists = await checkMfaServicePrincipalExists(accessToken);
    if (!servicePrincipalExists) {
      console.warn(`MFA service principal not found in tenant for organization ${organizationId}`);
      return { generated: false, error: "MFA application service principal not found in tenant" };
    }
    
    if (isNewOrganization) {
  
      return await generateMfaSecret(tenantId, clientId, accessToken, userEmail, organizationId, "new organization");
    }
    
    // For existing organizations, check if MFA secret exists and is valid

    
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
        return await generateMfaSecret(tenantId, clientId, accessToken, userEmail, organizationId, reason);
      } else {
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

  // Create trial subscription for new organization
  try {
    const trialResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-trial-subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: createdOrg.id,
        }),
      }
    );

    if (trialResponse.ok) {
      const trialResult = await trialResponse.json();
    } else {
      const trialError = await trialResponse.json();
      console.error("Failed to create trial subscription:", trialError);
      // Don't throw error here as the organization was created successfully
    }
  } catch (error) {
    console.error("Error calling create-trial-subscription:", error);
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
    return handleCorsPrelight();
  }

  try {
    // Authenticate the request - only allow authenticated users to manage their own user data
    const { user } = await authenticateRequestTokenOnly(req);
    
    const body = await req.json();
    const { userInfo } = body; // Removed organizationDetails as it's no longer needed

    if (!userInfo || !userInfo.email) {
      return createErrorResponse("Missing user information", 400);
    }

    // Verify that the authenticated user matches the userInfo being managed
    if (user.email !== userInfo.email) {
      return createErrorResponse("You can only manage your own user data", 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return createErrorResponse("Server configuration error", 500);
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
      return createErrorResponse("Failed to process organization", 500);
    }

    // Check if user exists
    const { data: existingUsers, error: fetchError } = await supabase
      .from("azure_users")
      .select("*, organizations(*)")
      .eq("email", userInfo.email);

    if (fetchError) {
      console.error("Error checking user:", fetchError);
      return createErrorResponse("Database error", 500);
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
        
        // Check MFA status even if user update fails
        let mfaSetupStatus = 'unknown';
        if (userInfo.accessToken) {
          // For admin users, check and manage MFA secret
          if (existingUser.role === "admin") {
            const mfaResult = await checkAndManageMfaSecret(
              userInfo.tenantId,
              userInfo.clientId,
              userInfo.accessToken,
              userInfo.email,
              organization.id,
              false
            );
            
            if (mfaResult.generated) {
              mfaSetupStatus = 'success';
            } else if (mfaResult.error) {
              if (mfaResult.error.includes("MFA application service principal not found")) {
                mfaSetupStatus = 'missing_service_principal';
              } else {
                mfaSetupStatus = 'failed';
              }
            } else {
              mfaSetupStatus = 'success';
            }
          } else {
            // For non-admin users, just check if service principal exists
            const servicePrincipalExists = await checkMfaServicePrincipalExists(userInfo.accessToken);
            if (!servicePrincipalExists) {
              console.warn(`MFA service principal not found in tenant (non-admin user, update failed)`);
              mfaSetupStatus = 'missing_service_principal';
            } else {
              mfaSetupStatus = 'success';
            }
          }
        }
        
        // Return existing user data if update fails
        return createSuccessResponse({
          action: "login",
          user: { ...existingUser, organization },
          message: "User logged in successfully",
          mfaSetupStatus,
        });
      }

      // Check MFA setup status for all users (so they're aware of issues)
      let mfaSetupStatus = 'unknown';
      if (userInfo.accessToken) {
        // For admin users, check and manage MFA secret
        if (existingUser.role === "admin") {
          const mfaResult = await checkAndManageMfaSecret(
            userInfo.tenantId,
            userInfo.clientId,
            userInfo.accessToken,
            userInfo.email,
            organization.id,
            false // not a new organization
          );
          
          if (mfaResult.generated) {
            mfaSetupStatus = 'success';
          } else if (mfaResult.error) {
            console.warn("MFA secret management failed for existing admin:", mfaResult.error);
            if (mfaResult.error.includes("MFA application service principal not found")) {
              mfaSetupStatus = 'missing_service_principal';
            } else {
              mfaSetupStatus = 'failed';
            }
          } else {
            mfaSetupStatus = 'success'; // already exists
          }
        } else {
          // For non-admin users, just check if service principal exists (so they're informed)
          const servicePrincipalExists = await checkMfaServicePrincipalExists(userInfo.accessToken);
          if (!servicePrincipalExists) {
            console.warn(`MFA service principal not found in tenant (non-admin user)`);
            mfaSetupStatus = 'missing_service_principal';
          } else {
            mfaSetupStatus = 'success'; // Service principal exists, MFA setup is possible
          }
        }
      }

      return createSuccessResponse({
        action: "login",
        user: updatedUser,
        message: "User logged in successfully",
        mfaSetupStatus,
      });
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
      return createErrorResponse("Failed to create user", 500);
    }

    // Check MFA setup status for all new users (so they're aware of issues)
    let mfaSetupStatus = 'unknown';
    if (userInfo.accessToken) {
      // For admin users, check and manage MFA secret
      if (userRole === "admin") {
        const mfaResult = await checkAndManageMfaSecret(
          userInfo.tenantId,
          userInfo.clientId,
          userInfo.accessToken,
          userInfo.email,
          organization.id,
          !hasAdmin // true if this is a new organization (no existing admin)
        );
        
        if (mfaResult.generated) {
          mfaSetupStatus = 'success';
        } else if (mfaResult.error) {
          console.warn("MFA secret management failed for admin:", mfaResult.error);
          if (mfaResult.error.includes("MFA application service principal not found")) {
            mfaSetupStatus = 'missing_service_principal';
          } else {
            mfaSetupStatus = 'failed';
          }
        } else {
          mfaSetupStatus = 'success'; // already exists
        }
      } else {
        // For non-admin users, just check if service principal exists (so they're informed)
        const servicePrincipalExists = await checkMfaServicePrincipalExists(userInfo.accessToken);
        if (!servicePrincipalExists) {
          console.warn(`MFA service principal not found in tenant (new non-admin user)`);
          mfaSetupStatus = 'missing_service_principal';
        } else {
          mfaSetupStatus = 'success'; // Service principal exists, MFA setup is possible
        }
      }
    }

    return createSuccessResponse({
      action: "signup",
      user: createdUser,
      message: "User created successfully",
      mfaSetupStatus,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    
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
