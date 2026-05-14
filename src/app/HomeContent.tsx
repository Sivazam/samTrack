'use client';

import React, { Suspense, lazy, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { TenantStatusGuard } from '@/components/TenantStatusGuard';
import { useRouter } from 'next/navigation';

// Lazy-load dashboards
const SuperAdminDashboard = lazy(() => import('@/components/SuperAdminDashboard'));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard'));
const PRODashboard = lazy(() => import('@/components/PRODashboard'));

export default function HomeContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // When auth is done loading and no user is found, redirect to login
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Show loading screen while auth is initializing
  if (loading) {
    return <AppLoadingScreen stage="Initializing..." />;
  }

  // No user — will redirect via useEffect above; show loading in the meantime
  if (!user) {
    return <AppLoadingScreen stage="Redirecting to login..." />;
  }

  // Route based on role
  if (user.role === 'SUPER_ADMIN') {
    return (
      <Suspense fallback={<AppLoadingScreen stage="Loading dashboard..." />}>
        <SuperAdminDashboard />
      </Suspense>
    );
  }

  if (user.role === 'COLLEGE_ADMIN' || user.role === 'MANAGER') {
    return (
      <TenantStatusGuard>
        <Suspense fallback={<AppLoadingScreen stage="Loading dashboard..." />}>
          <AdminDashboard />
        </Suspense>
      </TenantStatusGuard>
    );
  }

  if (user.role === 'PRO') {
    return (
      <TenantStatusGuard>
        <Suspense fallback={<AppLoadingScreen stage="Loading dashboard..." />}>
          <PRODashboard />
        </Suspense>
      </TenantStatusGuard>
    );
  }

  // Fallback - unknown role
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <p className="text-muted-foreground">Unknown role. Please contact your administrator.</p>
    </div>
  );
}
