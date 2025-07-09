# Secure Reset Approval Flow

A Next.js application with Microsoft Azure AD authentication integration.

## Features

- **Microsoft Azure AD Authentication**: Secure login using Azure AD with PKCE (Proof Key for Code Exchange)
- **Client-side Token Exchange**: Handles authorization code flow entirely on the client-side for SPA compatibility
- **Session Management**: Secure token storage and user session handling
- **Supabase Integration**: User management and data storage
- **Modern UI**: Clean, responsive interface built with Tailwind CSS and shadcn/ui

## Authentication Flow

1. User clicks "Sign in with Microsoft"
2. MSAL redirects to Azure AD with PKCE challenge
3. User authenticates with Microsoft
4. Azure AD redirects back with authorization code
5. Client-side token exchange using PKCE verifier
6. User data processing and session creation
7. Redirect to admin portal

## Configuration

### Azure AD Settings
- **Client ID**: `aad5399a-e678-4857-80be-a1664910d86a`
- **Redirect URI**: `http://localhost:3000/auth-callback`
- **Application Type**: Single-Page Application (SPA)
- **Scopes**: `User.Read`, `openid`, `profile`

### Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Azure AD Configuration (already configured)
# AZURE_CLIENT_ID=aad5399a-e678-4857-80be-a1664910d86a

# Stripe Configuration (if using Stripe)
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

### Current Configuration
- **Supabase URL**: `https://lbyvutzdimidlzgbjstz.supabase.co`
- **Development Port**: `3000`

## Key Files

- `src/userAuthConfig.ts` - MSAL configuration
- `src/contexts/AuthContext.tsx` - Authentication context and user management
- `src/app/auth-callback/page.tsx` - Handles OAuth callback and token exchange
- `src/app/page.tsx` - Login page
- `src/app/admin-portal/page.tsx` - Protected admin interface

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Security Features

- **PKCE Flow**: Prevents authorization code interception attacks
- **Session Storage**: Secure token storage in browser session
- **Client-side Validation**: JWT token validation and user data extraction
- **Automatic Cleanup**: Session cleanup on logout and errors

## Dependencies

- Next.js 14
- React 18
- @azure/msal-browser & @azure/msal-react
- Tailwind CSS
- shadcn/ui components
- jwt-decode

## License

Private project - All rights reserved.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Next JS
- TypeScript
- shadcn-ui
- Tailwind CSS

