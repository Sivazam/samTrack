'use client';

import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Minimal inline spinner for Suspense fallback (lighter than AppLoadingScreen)
function MinimalSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  );
}

// Lightweight loading screen for initial auth check (no heavy animations)
function AuthCheckLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Loading...</span>
        </div>
      </div>
    </div>
  );
}

// Lazy-load dashboards
const SuperAdminDashboard = lazy(() => import('@/components/SuperAdminDashboard'));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard'));
const PRODashboard = lazy(() => import('@/components/PRODashboard'));

export default function HomeContent() {
  const { user, loading } = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    // When auth is done loading and no user is found, redirect to login
    if (!loading && !user && !redirected.current) {
      redirected.current = true;
      window.location.replace('/login');
      const timer = setTimeout(() => {
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, user]);

  // Reset redirect flag when user logs in
  useEffect(() => {
    if (user) {
      redirected.current = false;
    }
  }, [user]);

  // Show lightweight loading only when we have no user at all
  // After login, user state is set immediately by login() with loading=false,
  // so the user should never see this loader on the login→dashboard path.
  // If user is set but role is undefined (fallback auth user), wait briefly
  // for the onSnapshot listener to populate role from Firestore cache.
  if (!user) {
    return <AuthCheckLoader />;
  }

  // User exists but role not yet loaded — show brief loader
  // (This handles the case where login used a fallback auth user
  // and onSnapshot hasn't yet fetched the real user doc from cache)
  if (!user.role) {
    return <AuthCheckLoader />;
  }

  // Route based on role
  if (user.role === 'SUPER_ADMIN') {
    return (
      <Suspense fallback={<MinimalSpinner message="Loading dashboard..." />}>
        <SuperAdminDashboard />
      </Suspense>
    );
  }

  if (user.role === 'COLLEGE_ADMIN' || user.role === 'MANAGER') {
    return (
      <Suspense fallback={<MinimalSpinner message="Loading dashboard..." />}>
        <AdminDashboard />
      </Suspense>
    );
  }

  if (user.role === 'PRO') {
    return (
      <Suspense fallback={<MinimalSpinner message="Loading dashboard..." />}>
        <PRODashboard />
      </Suspense>
    );
  }

  // Fallback - no matching role
  // If role is set but doesn't match any known role, show dashboard anyway
  // (Admin/Manager is the safest fallback for any non-PRO role)
  return (
    <Suspense fallback={<MinimalSpinner message="Loading dashboard..." />}>
      <AdminDashboard />
    </Suspense>
  );
}
