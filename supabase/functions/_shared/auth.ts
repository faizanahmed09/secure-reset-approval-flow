// Shared authentication utility for Supabase Edge Functions
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthenticatedUser {
  email: string;
  objectId: string;
  tenantId: string;
  name?: string;
  clientId: string;
  exp: number;
}

export interface AuthResult {
  user: AuthenticatedUser;
  dbUser?: any; // Optional database user info
}

/**
 * Decodes and validates an Azure AD JWT token
 */
function decodeJwtToken(token: string): AuthenticatedUser {
  try {
    // Validate JWT format
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format - must have 3 parts');
    }

    // Use the same simple decoding approach that works on client side
    let payload;
    try {
      payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (decodeError: any) {
      // If simple decode fails, try with padding (some JWTs need it)
      try {
        let base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const paddingNeeded = 4 - (base64Payload.length % 4);
        if (paddingNeeded < 4) {
          base64Payload += '='.repeat(paddingNeeded);
        }
        payload = JSON.parse(atob(base64Payload));
      } catch (paddedDecodeError: any) {
        throw new Error(`Failed to decode JWT payload: ${decodeError.message}`);
      }
    }

    // Log basic JWT validation success

    
    // Validate required fields with detailed error messages
    if (!payload.preferred_username && !payload.email && !payload.upn) {
      throw new Error('No email found in token. Available claims: ' + Object.keys(payload).join(', '));
    }
    
    if (!payload.oid && !payload.sub) {
      throw new Error('No object ID found in token. Available claims: ' + Object.keys(payload).join(', '));
    }
    
    if (!payload.tid) {
      throw new Error('No tenant ID found in token. Available claims: ' + Object.keys(payload).join(', '));
    }
    
    if (!payload.aud) {
      throw new Error('No audience found in token. Available claims: ' + Object.keys(payload).join(', '));
    }

    // Check token expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const expiredDate = new Date(payload.exp * 1000);
      throw new Error(`Token has expired at ${expiredDate.toISOString()}`);
    }

    return {
      email: payload.preferred_username || payload.email || payload.upn,
      objectId: payload.oid || payload.sub,
      tenantId: payload.tid,
      name: payload.name,
      clientId: payload.aud,
      exp: payload.exp
    };
  } catch (error: any) {
    console.error('JWT decode error details:', error);
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

/**
 * Authenticates a request by validating the Azure JWT token
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header must start with "Bearer "');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const user = decodeJwtToken(token);
    
    return { user };
  } catch (error: any) {
    console.error('Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Authenticates a request and fetches associated database user info
 */
export async function authenticateRequestWithDbUser(req: Request): Promise<AuthResult> {
  const authResult = await authenticateRequest(req);
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server configuration error: Missing Supabase credentials");
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Fetch user from database
  const { data: dbUser, error } = await supabase
    .from("azure_users")
    .select(`
      id,
      email,
      name,
      tenant_id,
      object_id,
      organization_id,
      role,
      is_active,
      created_at,
      updated_at,
      last_login_at,
      organizations (
        id,
        name,
        domain,
        display_name,
        is_active
      )
    `)
    .eq("email", authResult.user.email)
    .eq("is_active", true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('User not found in database');
    }
    throw new Error(`Database error: ${error.message}`);
  }
  
  if (!dbUser) {
    throw new Error('User not found or inactive');
  }
  
  // Verify token tenant matches database user tenant
  if (dbUser.tenant_id !== authResult.user.tenantId) {
    throw new Error('Token tenant does not match user tenant');
  }
  
  return {
    ...authResult,
    dbUser
  };
}

/**
 * OPTIMIZED: Fast authentication with minimal database query
 * Use this for better performance when you don't need organization details
 */
export async function authenticateRequestFast(req: Request): Promise<AuthResult> {
  const authResult = await authenticateRequest(req);
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Server configuration error: Missing Supabase credentials");
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Fetch only essential user data without JOIN
  const { data: dbUser, error } = await supabase
    .from("azure_users")
    .select("id, email, organization_id, role, is_active, tenant_id")
    .eq("email", authResult.user.email)
    .eq("is_active", true)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('User not found in database');
    }
    throw new Error(`Database error: ${error.message}`);
  }
  
  if (!dbUser) {
    throw new Error('User not found or inactive');
  }
  
  // Verify token tenant matches database user tenant
  if (dbUser.tenant_id !== authResult.user.tenantId) {
    throw new Error('Token tenant does not match user tenant');
  }
  
  return {
    ...authResult,
    dbUser
  };
}

/**
 * SUPER FAST: Token-only authentication for functions that don't need database user info
 * Use this for maximum performance when you only need JWT validation
 */
export async function authenticateRequestTokenOnly(req: Request): Promise<AuthResult> {
  return await authenticateRequest(req);
}

/**
 * Checks if the authenticated user has a specific role
 */
export function requireRole(dbUser: any, allowedRoles: string[]): void {
  if (!dbUser.role || !allowedRoles.includes(dbUser.role)) {
    throw new Error(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`);
  }
}

/**
 * Checks if the authenticated user belongs to a specific organization
 */
export function requireOrganization(dbUser: any, organizationId: string): void {
  if (dbUser.organization_id !== organizationId) {
    throw new Error('User does not belong to the specified organization');
  }
}

/**
 * Standard CORS headers for edge functions
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Handles CORS preflight requests
 */
export function handleCorsPrelight(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(message: string, status: number = 400, details?: any): Response {
  const responseBody: any = { 
    success: false, 
    message,
    timestamp: new Date().toISOString(),
    code: status
  };
  
  if (details) {
    responseBody.details = details;
  }
  
  return new Response(
    JSON.stringify(responseBody),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...(message && { message }),
      ...data,
      timestamp: new Date().toISOString()
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
} 