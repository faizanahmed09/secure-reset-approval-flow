'use client';
import UsersComponent from '@/components/UsersComponent';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { BeautifulLoader } from '@/app/loader';
import React, { useEffect } from 'react'

const UsersRoutePage = () => {
  const { user, isLoading, isAuthenticated, isSessionExpired } = useAuth();
  const router = useRouter();

  // Handle redirect for unauthenticated users (but not when session expired modal is showing)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isSessionExpired) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, isSessionExpired, router]);

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Show loader while redirecting to login if not authenticated (but not when session expired modal is showing)
  if (!isAuthenticated && !isSessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  return (
    <div>
      <UsersComponent />
    </div>
  )
}

export default UsersRoutePage
