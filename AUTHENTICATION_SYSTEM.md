# Authentication System Documentation

## Overview

This document describes the comprehensive authentication system implemented in the Secure Reset Approval Flow application using Azure AD (Microsoft Entra ID) and Supabase Edge Functions. The system provides secure, role-based access control with JWT token validation and database user verification.

## Architecture

### Components

1. **Azure AD Authentication**: Primary authentication provider using MSAL (Microsoft Authentication Library)
2. **Supabase Edge Functions**: Backend API endpoints with custom authentication middleware
3. **JWT Token Validation**: Custom token validation for Azure AD JWTs
4. **Database User Verification**: User existence and role validation in Supabase
5. **Role-Based Access Control**: Granular permissions based on user roles

### Authentication Flow

```
Client (Next.js) → Azure AD → JWT Token → Edge Function → Database Verification → Response
```

## Edge Function Authentication Implementation

### Core Authentication Module (`_shared/auth.ts`)

The authentication system is centralized in the `supabase/functions/_shared/auth.ts` module, providing reusable authentication utilities for all edge functions.

#### Key Interfaces

```typescript
interface AuthenticatedUser {
  email: string;
  objectId: string;
  tenantId: string;
  name?: string;
  clientId: string;
  exp: number;
}

interface AuthResult {
  user: AuthenticatedUser;
  dbUser?: any; // Optional database user info
}
```

#### Authentication Functions

##### 1. `authenticateRequest(req: Request): Promise<AuthResult>`
- **Purpose**: Basic JWT token validation without database lookup
- **Use Case**: When you only need to verify the token is valid
- **Performance**: Fastest option, no database queries
- **Returns**: Token payload information only

##### 2. `authenticateRequestWithDbUser(req: Request): Promise<AuthResult>`
- **Purpose**: Full authentication with database user verification
- **Use Case**: When you need user details, organization info, and role validation
- **Performance**: Slower due to database JOIN query
- **Returns**: Token payload + complete user information with organization details

##### 3. `authenticateRequestFast(req: Request): Promise<AuthResult>`
- **Purpose**: Optimized authentication with minimal database query
- **Use Case**: When you need user info but don't need organization details
- **Performance**: Faster than full authentication, no JOIN
- **Returns**: Token payload + essential user information

##### 4. `authenticateRequestTokenOnly(req: Request): Promise<AuthResult>`
- **Purpose**: Token-only validation for maximum performance
- **Use Case**: Internal service functions or when database user info is not needed
- **Performance**: Fastest, no database queries
- **Returns**: Token payload only

#### JWT Token Validation

The system implements custom JWT token validation for Azure AD tokens:

```typescript
function decodeJwtToken(token: string): AuthenticatedUser {
  // 1. Validate JWT format (3 parts: header.payload.signature)
  // 2. Decode base64 payload with padding handling
  // 3. Validate required claims:
  //    - email (preferred_username, email, or upn)
  //    - object ID (oid or sub)
  //    - tenant ID (tid)
  //    - audience (aud)
  // 4. Check token expiration
  // 5. Return structured user information
}
```

**Required JWT Claims:**
- `preferred_username` or `email` or `upn`: User's email address
- `oid` or `sub`: User's object ID in Azure AD
- `tid`: Tenant ID (organization identifier)
- `aud`: Audience (client ID)
- `exp`: Expiration timestamp

#### Authorization Functions

##### `requireRole(dbUser: any, allowedRoles: string[])`
- Validates that the authenticated user has one of the specified roles
- Throws error if user lacks required permissions
- Used for role-based access control

##### `requireOrganization(dbUser: any, organizationId: string)`
- Ensures user belongs to the specified organization
- Prevents cross-organization data access
- Used for multi-tenant security

## Edge Function Implementation Patterns

### Standard Authentication Pattern

```typescript
import {
  authenticateRequestWithDbUser,
  requireRole,
  requireOrganization,
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPrelight();
  }

  try {
    // 1. Authenticate request
    const { dbUser } = await authenticateRequestWithDbUser(req);
    
    // 2. Check role permissions
    requireRole(dbUser, ['admin', 'verifier']);
    
    // 3. Validate organization access
    const { organizationId } = await req.json();
    requireOrganization(dbUser, organizationId);
    
    // 4. Process request
    // ... business logic ...
    
    // 5. Return response
    return createSuccessResponse(data);
    
  } catch (error) {
    // Handle authentication errors with appropriate status codes
    if (error.message.includes('Authorization') || 
        error.message.includes('Token') ||
        error.message.includes('User not found') ||
        error.message.includes('permissions')) {
      return createErrorResponse(error.message, 401);
    }
    
    return createErrorResponse("Internal server error", 500);
  }
});
```

### Performance-Optimized Pattern

```typescript
// For functions that don't need organization details
const { dbUser } = await authenticateRequestFast(req);
requireRole(dbUser, ['admin']);

// For internal service functions
const { user } = await authenticateRequestTokenOnly(req);
```

## Security Features

### 1. Multi-Layer Validation
- **JWT Format Validation**: Ensures proper JWT structure
- **Token Expiration Check**: Prevents use of expired tokens
- **Required Claims Validation**: Ensures all necessary claims are present
- **Database User Verification**: Confirms user exists and is active
- **Tenant Matching**: Ensures token tenant matches database tenant

### 2. Role-Based Access Control
- **Admin**: Full system access, can manage users and organizations
- **Verifier**: Can verify user requests and view logs
- **View Only**: Read-only access to basic information

### 3. Organization Isolation
- Users can only access data within their organization
- Cross-organization access is prevented
- Multi-tenant security enforced

### 4. Error Handling
- Detailed error messages for debugging
- Appropriate HTTP status codes
- No sensitive information leaked in errors

## Configuration

### Supabase Edge Function Configuration

```toml
# supabase/config.toml
[functions.send-mfa-push]
verify_jwt = false  # Disable Supabase JWT verification for custom Azure AD validation
```

**Critical Configuration Note:**
Edge functions using Azure AD authentication must be deployed with `verify_jwt = false` to disable Supabase's built-in JWT verification and allow custom Azure AD token validation.

### Environment Variables

Required environment variables for edge functions:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MFA_CLIENT_ID=your_azure_client_id
MFA_SECRET_ENCRYPTION_KEY=your_encryption_key
```

## Error Handling

### Authentication Error Types

1. **401 Unauthorized**
   - Missing Authorization header
   - Invalid JWT format
   - Token expired
   - User not found in database
   - Insufficient permissions

2. **403 Forbidden**
   - User doesn't belong to specified organization
   - Tenant ID mismatch

3. **500 Internal Server Error**
   - Database connection issues
   - Configuration errors

### Standardized Error Responses

```typescript
createErrorResponse(message: string, status: number = 400, details?: any)
```

Returns structured error responses:
```json
{
  "success": false,
  "message": "Error description",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "code": 401,
  "details": { /* optional additional info */ }
}
```

## Performance Considerations

### Authentication Performance Tiers

1. **Token-Only**: Fastest, no database queries
2. **Fast Authentication**: Minimal database query, no JOINs
3. **Full Authentication**: Complete user info with organization details

### Best Practices

- Use `authenticateRequestFast()` when organization details aren't needed
- Use `authenticateRequestTokenOnly()` for internal service functions
- Use `authenticateRequestWithDbUser()` only when full user context is required
- Implement proper error handling with appropriate status codes
- Use CORS headers for cross-origin requests

## Deployment Considerations

### Azure AD Configuration

1. **App Registration**: Configure Azure AD app with required permissions
2. **Redirect URIs**: Set up proper redirect URIs for authentication flow
3. **API Permissions**: Grant necessary Microsoft Graph API permissions
4. **Client Secrets**: Store and encrypt sensitive credentials

### Supabase Deployment

1. **Edge Functions**: Deploy with `verify_jwt = false` for Azure AD functions
2. **Database**: Ensure proper RLS (Row Level Security) policies
3. **Environment Variables**: Configure all required environment variables
4. **CORS**: Configure CORS headers for client access

## Monitoring and Logging

### Authentication Logs

The system logs authentication events for monitoring:
- Successful authentications
- Failed authentication attempts
- Token validation errors
- Database user verification failures

### Security Monitoring

Monitor for:
- Unusual authentication patterns
- Failed token validations
- Cross-organization access attempts
- Role escalation attempts

## Troubleshooting

### Common Issues

1. **"Token validation failed"**
   - Check JWT format and claims
   - Verify token expiration
   - Ensure proper Azure AD configuration

2. **"User not found in database"**
   - Verify user exists in azure_users table
   - Check user is_active status
   - Confirm email matches between token and database

3. **"Tenant ID mismatch"**
   - Ensure token tenant matches database tenant
   - Verify Azure AD tenant configuration

4. **"Insufficient permissions"**
   - Check user role in database
   - Verify required roles for the operation
   - Confirm role-based access control configuration

### Debug Mode

Enable detailed logging by checking console output in edge function logs for:
- JWT decode details
- Database query results
- Authentication flow steps
- Error details and stack traces

## Security Best Practices

1. **Token Security**
   - Always validate JWT tokens on every request
   - Check token expiration
   - Verify all required claims
   - Use HTTPS for all communications

2. **Database Security**
   - Use service role keys only in edge functions
   - Implement proper RLS policies
   - Validate user organization membership
   - Check user active status

3. **Error Handling**
   - Don't leak sensitive information in error messages
   - Use appropriate HTTP status codes
   - Log security events for monitoring
   - Implement rate limiting for authentication endpoints

4. **Configuration Security**
   - Store sensitive keys in environment variables
   - Use encryption for client secrets
   - Regularly rotate credentials
   - Monitor for unauthorized access attempts

This authentication system provides a robust, secure foundation for the Secure Reset Approval Flow application, ensuring proper access control while maintaining performance and scalability. 