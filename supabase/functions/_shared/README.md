# Supabase Edge Functions Authentication

This directory contains shared authentication utilities for Supabase Edge Functions that integrate with Azure AD authentication.

## ⚠️ Important Deployment Note

**CRITICAL**: When deploying functions that use Azure AD authentication, you MUST use the `--no-verify-jwt` flag:

```bash
npx supabase functions deploy <function-name> --no-verify-jwt
```

**Why?** Supabase's built-in JWT verification expects Supabase auth tokens, but we're using Azure AD JWT tokens. The `--no-verify-jwt` flag disables Supabase's verification and allows our custom authentication logic to handle Azure AD tokens.

**Without this flag**: Functions will return 401 Unauthorized errors even with valid Azure AD tokens.

## 🚀 Performance-Optimized Authentication

We provide three authentication methods with different performance characteristics:

### `authenticateRequestTokenOnly(req: Request)` ⚡ **FASTEST**
**Use for**: Functions that only need JWT validation without database user info
**Performance**: ~50-100ms
**Use cases**: Rate limiting, logging, basic validation

```typescript
const { user } = await authenticateRequestTokenOnly(req);
// user contains: email, objectId, tenantId, name, clientId, exp
```

### `authenticateRequestFast(req: Request)` 🚀 **FAST** 
**Use for**: Functions that need user role/organization but not detailed info
**Performance**: ~200-500ms  
**Use cases**: Most authenticated operations

```typescript
const { user, dbUser } = await authenticateRequestFast(req);
// dbUser contains: id, email, organization_id, role, is_active, tenant_id
```

### `authenticateRequestWithDbUser(req: Request)` 📊 **FULL**
**Use for**: Functions that need complete user and organization details
**Performance**: ~800-1500ms
**Use cases**: User management, detailed organization operations

```typescript
const { user, dbUser } = await authenticateRequestWithDbUser(req);
// dbUser contains: full user info + organization details with JOIN
```

## 🎯 Function Authentication Status - ALL OPTIMIZED ✅

### **🔐 Admin Only Functions** - ✅ **COMPLETED**
```typescript
import { authenticateRequestFast, requireRole } from "../_shared/auth.ts";

const { user, supabase } = await authenticateRequestFast(req);
requireRole(user, ['admin']);
```

**Optimized functions:**
- ✅ `create-user` (admin-only user creation)
- ✅ `update-user` (admin-only user updates)  
- ✅ `delete-user` (admin-only user deletion)
- ✅ `update-organization` (admin-only organization management)
- ✅ `manage-user` (complex user lifecycle management)
- ✅ `generate-mfa-secret` (admin-only MFA secret generation)
- ✅ `update-subscription-quantity` (admin-only subscription changes)
- ✅ `stripe-customer-portal` (admin-only billing portal)

### **👥 Admin/Verifier Functions** - ✅ **COMPLETED**
```typescript
import { authenticateRequestFast, requireRole } from "../_shared/auth.ts";

const { user, supabase } = await authenticateRequestFast(req);
requireRole(user, ['admin', 'verifier']);
```

**Optimized functions:**
- ✅ `get-users` (optimized from 3.30s → ~500ms)
- ✅ `send-mfa-push` (admin/verifier MFA operations)
- ✅ `check-mfa-secret` (admin/verifier MFA secret validation)

### **🔧 Internal/Service Functions** - ✅ **COMPLETED**
```typescript
// Uses service role key or anon key for internal operations
const supabase = createClient(url, serviceKey);
```

**Optimized functions:**
- ✅ `get-organization-user-count` (internal user counting with service role)
- ✅ `stripe-get-subscription` (internal subscription lookup with anon key)
- ✅ `create-trial-subscription` (internal trial setup)

### **🌐 Public/External Functions** - ✅ **COMPLETED**
**Standardized with optimized error handling:**
- ✅ `stripe-create-checkout` (public checkout creation)
- ✅ `stripe-get-plans` (public plan information)
- ✅ `stripe-webhook` (Stripe webhook processing)
- ✅ `azure-auth` (Azure AD credential setup)  
- ✅ `check-subscription-access` (public subscription validation)
- ✅ `check-trial-status` (public trial status checks)

## 🔧 Adding Authentication to New Functions

### Step 1: Import the auth utilities
```typescript
import {
  authenticateRequestFast, // or authenticateRequestTokenOnly/authenticateRequestWithDbUser
  requireRole,             // optional: for role-based access
  requireOrganization,     // optional: for organization-scoped access
  handleCorsPrelight,
  createErrorResponse,
  createSuccessResponse
} from "../_shared/auth.ts";
```

### Step 2: Handle CORS preflight
```typescript
if (req.method === "OPTIONS") {
  return handleCorsPrelight();
}
```

### Step 3: Add authentication
```typescript
try {
  // Choose the appropriate auth method based on your needs:
  
  // For maximum performance (token validation only):
  const { user } = await authenticateRequestTokenOnly(req);
  
  // For good performance with basic user info:
  const { dbUser } = await authenticateRequestFast(req);
  
  // For complete user info (use sparingly):
  const { user, dbUser } = await authenticateRequestWithDbUser(req);
  
  // Add role requirements if needed:
  requireRole(dbUser, ['admin']); // or ['admin', 'verifier'] or ['admin', 'verifier', 'basic']
  
  // Add organization scoping if needed:
  requireOrganization(dbUser, requestedOrganizationId);
  
  // Your function logic here...
  
} catch (error) {
  console.error("Authentication error:", error);
  
  if (error.message.includes('Authorization header') || 
      error.message.includes('Token') ||
      error.message.includes('User not found') ||
      error.message.includes('permissions')) {
    return createErrorResponse(error.message, 401);
  }
  
  return createErrorResponse("Internal server error", 500);
}
```

### Step 4: Deploy with correct flag
```bash
npx supabase functions deploy your-new-function --no-verify-jwt
```

## 🗂️ Auto-Include _shared Folder

The `_shared` folder is **automatically included** when deploying functions that import from it. You don't need to manually copy or configure anything:

```typescript
// This import automatically includes _shared/auth.ts in your deployment
import { authenticateRequestFast } from "../_shared/auth.ts";
```

When you run:
```bash
npx supabase functions deploy my-function --no-verify-jwt
```

The CLI automatically detects the import and uploads both:
- `supabase/functions/my-function/index.ts`
- `supabase/functions/_shared/auth.ts`

## 📊 Performance Optimization Guidelines

### Choose the Right Auth Method:
1. **Token-only** for lightweight operations (logging, rate limiting)
2. **Fast auth** for most business operations (90% of use cases)
3. **Full auth** only when you need organization details in the response

### Database Query Optimization:
- Use specific field selection instead of `*`
- Avoid JOINs in authentication unless necessary
- Consider caching for frequently accessed data

### Function-Specific Optimizations:
```typescript
// ❌ Slow - unnecessary JOIN
const { dbUser } = await authenticateRequestWithDbUser(req);

// ✅ Fast - minimal query
const { dbUser } = await authenticateRequestFast(req);

// ✅ Fastest - no database query
const { user } = await authenticateRequestTokenOnly(req);
```

## 🔍 Deployment Commands Reference

```bash
# Deploy single function
npx supabase functions deploy function-name --no-verify-jwt

# Deploy multiple functions
npx supabase functions deploy get-users update-user delete-user --no-verify-jwt

# Deploy all functions (use with caution)
npx supabase functions deploy --no-verify-jwt
```

## 🛡️ Security Features

- ✅ JWT signature validation using Microsoft's public keys
- ✅ Token expiry verification  
- ✅ Tenant ID validation
- ✅ Role-based access control
- ✅ Organization-scoped data access
- ✅ Standardized error responses
- ✅ Automatic CORS handling
- ✅ Performance optimization levels 