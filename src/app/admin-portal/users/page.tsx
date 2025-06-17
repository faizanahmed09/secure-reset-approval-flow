'use client';
import UsersComponent from '@/components/UsersComponent';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { BeautifulLoader } from '@/app/loader';
import React from 'react'

const UsersRoutePage = () => {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Show loader while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <BeautifulLoader />
      </div>
    );
  }

  // Redirect to admin portal if not authenticated
  if (!isAuthenticated) {
    router.push('/admin-portal');
    return null;
  }

  return (
    <div>
      <UsersComponent />
    </div>
  )
}

export default UsersRoutePage
