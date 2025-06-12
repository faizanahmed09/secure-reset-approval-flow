'use client';

import { useMsal } from '@azure/msal-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { instance } = useMsal();
  const { handleLoginRedirect, isLoading, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    try {
      await handleLoginRedirect(instance);
    } catch (error) {
      console.error('Error during login:', error);
    }
  };

  // If user is already authenticated, redirect to admin portal
  if (isAuthenticated) {
    window.location.href = '/admin-portal';
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Welcome</CardTitle>
          <CardDescription className="text-center">
            Sign in with your Microsoft account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md flex items-center gap-2"
          >
            <Shield className="h-5 w-5" />
            {isLoading ? 'Signing in...' : 'Sign in with Microsoft'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index; 