'use client';

import { useMsal } from '@azure/msal-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import Loader from '@/components/common/Loader';

const Index = () => {
  const { instance } = useMsal();
  const { handleLoginRedirect, isLoading, isAuthenticated } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Simple auto-login with a brief delay for all users
  useEffect(() => {
    if (!isAuthenticated && !isLoading && !isRedirecting) {
      // Small delay to let users see the welcome screen briefly
      const timer = setTimeout(() => {
        setIsRedirecting(true);
        handleLoginRedirect(instance).catch((error) => {
          console.error('Error during auto-login:', error);
          setIsRedirecting(false);
        });
      }, 1500); // 1.5 second delay for all users

      return () => clearTimeout(timer);
    }
  }, [instance, handleLoginRedirect, isAuthenticated, isLoading, isRedirecting]);

  // Handle redirect for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/admin-portal';
    }
  }, [isAuthenticated]);

  // If user is already authenticated, show loading state while redirecting
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader 
        text="Welcome to AuthenPush" 
        subtext="Redirecting to Microsoft sign-in..."
      />
    </div>
  );
};

export default Index; 