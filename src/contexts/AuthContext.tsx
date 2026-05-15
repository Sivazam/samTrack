'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { initializeFCM, cleanupFCM } from '@/lib/fcm';
import { syncClaimsViaCloudFunction } from '@/lib/cloud-functions';
import { AuthUser, AuthContextType, Role } from '@/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const authVersionRef = useRef(0);

  // Fetch user doc from Firestore (cache-first)
  const fetchUserDoc = useCallback(async (uid: string): Promise<AuthUser | null> => {
    try {
      const userRef = doc(db, 'users', uid);
      
      // Safety timeout: don't hang forever if network drops
      const userDoc = await Promise.race([
        getDoc(userRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout fetching user profile')), 15000))
      ]);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          uid,
          email: data.email || '',
          displayName: data.displayName || '',
          tenantId: data.tenantId,
          tenantStatus: undefined, // Will be populated from tenant doc
          role: data.role as Role,
          teamId: data.teamId || undefined,
          assignedDivisionIds: data.assignedDivisionIds || [],
          username: data.username,
          phone: data.phone || undefined,
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user doc:', error);
      return null;
    }
  }, []);

  // Fetch tenant info
  const fetchTenantInfo = useCallback(async (tenantId: string): Promise<{ name?: string; status?: string; branding?: any }> => {
    try {
      const tenantRef = doc(db, 'tenants', tenantId);
      
      const tenantDoc = await Promise.race([
        getDoc(tenantRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout fetching tenant info')), 15000))
      ]);
      
      if (tenantDoc.exists()) {
        const data = tenantDoc.data();
        return {
          name: data.name,
          status: data.status,
          branding: data.branding,
        };
      }
      return {};
    } catch (error) {
      console.error('Error fetching tenant info:', error);
      return {};
    }
  }, []);

  // Build AuthUser from Firebase User + Firestore user doc + tenant doc
  const buildAuthUser = useCallback(async (firebaseUser: User): Promise<AuthUser | null> => {
    setLoadingStage('Loading user profile...');
    setLoadingProgress(30);

    const userDoc = await fetchUserDoc(firebaseUser.uid);
    if (!userDoc) return null;

    setLoadingStage('Loading tenant info...');
    setLoadingProgress(50);

    let tenantInfo: { name?: string; status?: string; branding?: any } = {};
    if (userDoc.tenantId) {
      tenantInfo = await fetchTenantInfo(userDoc.tenantId);
    }

    setLoadingStage('Syncing permissions...');
    setLoadingProgress(70);

    // Sync custom claims periodically (not on every load)
    try {
      const lastSync = localStorage.getItem('__claims_last_sync');
      const shouldSync = !lastSync || Date.now() - parseInt(lastSync) > 60 * 60 * 1000; // 1 hour
      if (shouldSync) {
        await syncClaimsViaCloudFunction();
        // Force-refresh the ID token so the new custom claims (role, tenantId)
        // are immediately available to Firestore security rules.  Without this
        // the token keeps stale claims until the next automatic 1-hour refresh.
        await firebaseUser.getIdToken(true);
        localStorage.setItem('__claims_last_sync', Date.now().toString());
      }
    } catch (e) {
      console.warn('Claims sync failed (non-critical):', e);
    }

    setLoadingProgress(90);
    setLoadingStage('Ready');

    return {
      ...userDoc,
      tenantStatus: tenantInfo.status,
      tenantName: tenantInfo.name,
      tenantBranding: tenantInfo.branding,
    };
  }, [fetchUserDoc, fetchTenantInfo]);

  // Login with email or username + password
  const login = useCallback(async (emailOrUsername: string, password: string) => {
    setLoading(true);
    setLoadingProgress(10);
    setLoadingStage('Signing in...');

    try {
      let email = emailOrUsername;

      // If input doesn't contain @, treat as username
      if (!emailOrUsername.includes('@')) {
        setLoadingStage('Resolving username...');
        const username = emailOrUsername.toLowerCase();

        // We need to know the tenantId to look up the username
        // For single-tenant, we can query usernameIndex without tenantId prefix
        // For multi-tenant, we'd need the tenant context first
        // For now: try to find the username index doc by querying
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const usernameQuery = query(
          collection(db, 'usernameIndex'),
          where('username', '==', username) // This might need adjustment for multi-tenant
        );

        // Better approach: since we're single-tenant, iterate usernameIndex
        // But we need tenantId for the doc ID format {tenantId}__{username}
        // Let's try a different approach: query by the username field
        const snap = await getDocs(usernameQuery);

        if (snap.empty) {
          // Try alternative: since doc IDs are {tenantId}__{username}, we can't query without tenantId
          // Fallback: just try all usernameIndex documents matching username suffix
          throw new Error('Invalid credentials');
        }

        const indexData = snap.docs[0].data();
        email = indexData.email;
      }

      setLoadingStage('Authenticating...');
      await signInWithEmailAndPassword(auth, email, password);

      // FCM registration will happen in onAuthStateChanged handler
    } catch (error: any) {
      setLoading(false);
      setLoadingProgress(0);
      // Don't leak whether it's username-not-found vs wrong-password
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' ||
          error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
        throw new Error('Invalid credentials');
      }
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      // Unregister FCM for current device
      await cleanupFCM();

      // Sign out from Firebase
      await firebaseSignOut(auth);

      // Clear SW auth state + caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'AUTH_STATE_CHANGED', isLoggedIn: false });
      }

      // Clear local state
      setUser(null);
      localStorage.removeItem('__claims_last_sync');

      // Hard reload to clear all in-memory state
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even on error
      window.location.href = '/';
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  // Role checks
  const hasRole = useCallback((role: Role) => {
    return user?.role === role;
  }, [user]);

  const isAdminOrManager = useCallback(() => {
    return user?.role === 'COLLEGE_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';
  }, [user]);

  const isPRO = useCallback(() => {
    return user?.role === 'PRO';
  }, [user]);

  const isSuperAdmin = useCallback(() => {
    return user?.role === 'SUPER_ADMIN';
  }, [user]);

  // Listen for auth state changes
  useEffect(() => {
    const currentVersion = ++authVersionRef.current;
    let resolved = false;

    const markResolved = () => {
      if (!resolved) {
        resolved = true;
        setLoading(false);
        setLoadingProgress(100);
        setLoadingStage('');
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (currentVersion !== authVersionRef.current) return; // Stale handler

      if (firebaseUser) {
        try {
          const authUser = await buildAuthUser(firebaseUser);

          if (currentVersion !== authVersionRef.current) return;

          if (authUser) {
            setUser(authUser);

            // Initialize FCM for push notifications
            try {
              await initializeFCM();
            } catch (e) {
              console.warn('FCM initialization failed (non-critical):', e);
            }

            // Notify service worker of auth state
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'AUTH_STATE_CHANGED',
                isLoggedIn: true,
                uid: authUser.uid,
                tenantId: authUser.tenantId,
                role: authUser.role,
              });
            }
          } else {
            // User doc not found - sign out
            await firebaseSignOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      markResolved();
    });

    // Safety timeout: if Firebase doesn't respond within 8 seconds,
    // force loading to false so the app isn't stuck forever.
    // This handles cases where Firebase config is missing/invalid.
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        console.warn('Auth state change timed out — forcing loading=false');
        markResolved();
      }
    }, 8000);

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [buildAuthUser]);

  // Real-time user doc updates via onSnapshot
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe: Unsubscribe | undefined;
    try {
      const userRef = doc(db, 'users', user.uid);
      unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setUser(prev => prev ? {
            ...prev,
            displayName: data.displayName || prev.displayName,
            phone: data.phone || prev.phone,
            role: data.role as Role,
            teamId: data.teamId || undefined,
            assignedDivisionIds: data.assignedDivisionIds || prev.assignedDivisionIds,
          } : prev);
        }
      });
    } catch (e) {
      console.warn('User doc snapshot failed:', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  const value: AuthContextType = {
    user,
    loading,
    loadingProgress,
    loadingStage,
    login,
    logout,
    resetPassword,
    hasRole,
    isAdminOrManager,
    isPRO,
    isSuperAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

// Convenience hooks
export function useCollegeAdmin() {
  const { user, ...rest } = useAuth();
  return { ...rest, user, isCollegeAdmin: user?.role === 'COLLEGE_ADMIN' };
}

export function useManager() {
  const { user, ...rest } = useAuth();
  return { ...rest, user, isManager: user?.role === 'MANAGER' };
}

export function usePRO() {
  const { user, ...rest } = useAuth();
  return { ...rest, user, isPRO: user?.role === 'PRO' };
}

export function useAdminOrManager() {
  const { user, ...rest } = useAuth();
  const isAdminOrManager = user?.role === 'COLLEGE_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN';
  return { ...rest, user, isAdminOrManager };
}
