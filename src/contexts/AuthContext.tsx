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
import { isAdminOrManager as isAdminOrManagerRole } from '@/lib/role-utils';

// Flags to control loading screen behavior
let _justLoggedIn = false;   // Set by login() to skip heavy loading cycle
let _skipLoadingScreen = false; // Set when we know user is returning (Firebase auto-login)

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const _loadingShown = useRef(false); // Track if loading screen was ever shown
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing...');
  const authVersionRef = useRef(0);
  const isInitialMount = useRef(true);

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
      throw error;
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
  const buildAuthUser = useCallback(async (firebaseUser: User, options?: { awaitClaims?: boolean }): Promise<AuthUser | null> => {
    // Fetch user doc and tenant info in parallel for faster login
    let userDoc: AuthUser | null = null;
    try {
      userDoc = await fetchUserDoc(firebaseUser.uid);
      if (!userDoc) return null; // Doesn't exist -> return null to trigger logout
    } catch (e) {
      console.warn("Falling back to token claims for user doc", e);
      // Construct minimal user from claims if network fails
      const token = await firebaseUser.getIdTokenResult();
      if (token.claims.tenantId && token.claims.role) {
        userDoc = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Offline User',
          tenantId: token.claims.tenantId as string,
          role: token.claims.role as Role,
          assignedDivisionIds: [],
        };
      } else {
        throw e; // Give up
      }
    }

    let tenantInfo: { name?: string; status?: string; branding?: any } = {};
    if (userDoc.tenantId) {
      tenantInfo = await fetchTenantInfo(userDoc.tenantId);
    }

    // Sync custom claims - await during initial load so Firestore rules work immediately.
    // If we already have the token from a previous run, it might be stale but we can fetch in background.
    const claimsPromise = (async () => {
      try {
        const lastSync = localStorage.getItem('__claims_last_sync');
        const shouldSync = !lastSync || Date.now() - parseInt(lastSync) > 60 * 60 * 1000;
        if (shouldSync) {
          const tokenResult = await firebaseUser.getIdTokenResult();
          // If the token already has the correct role and tenantId, we don't need to block UI, sync in background.
          const hasClaims = !!tokenResult.claims.role;
          
          if (hasClaims && !options?.awaitClaims) {
            syncClaimsViaCloudFunction().then(() => {
              firebaseUser.getIdToken(true);
              localStorage.setItem('__claims_last_sync', Date.now().toString());
            }).catch(e => console.warn('Background claims sync failed:', e));
          } else {
             setLoadingStage('Syncing permissions...');
             setLoadingProgress(70);
             await syncClaimsViaCloudFunction();
             await firebaseUser.getIdToken(true);
             localStorage.setItem('__claims_last_sync', Date.now().toString());
          }
        }
      } catch (e) {
        console.warn('Claims sync failed (non-critical):', e);
      }
    })();

    // Always await claims promise initially unless it kicked to background
    await claimsPromise;

    return {
      ...userDoc,
      tenantStatus: tenantInfo.status,
      tenantName: tenantInfo.name,
      tenantBranding: tenantInfo.branding,
    };
  }, [fetchUserDoc, fetchTenantInfo]);

  // Login with email or username + password
  const login = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      setLoading(true);
      setLoadingStage('Authenticating...');
      setLoadingProgress(20);
      
      let email = emailOrUsername;

      // If input doesn't contain @, treat as username
      if (!emailOrUsername.includes('@')) {
        const { resolveUsernameToEmailViaCloudFunction } = await import('@/lib/cloud-functions');
        const result = await resolveUsernameToEmailViaCloudFunction({ username: emailOrUsername.toLowerCase() });
        if (!result?.email) throw new Error('Invalid credentials');
        email = result.email;
      }

      setLoadingStage('Verifying credentials...');
      setLoadingProgress(40);
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Build auth user immediately. We don't need to await claims anymore because
      // Firestore rules use `sameTenantOrUnsynced` to read the user doc directly 
      // if claims (like tenantId) are missing from the token.
      _justLoggedIn = true;
      const authUser = await buildAuthUser(credential.user, { awaitClaims: false });

      // CRITICAL: Always set user and loading=false, even if buildAuthUser returns null
      // (e.g. Firestore permission-denied during claims sync window).
      // Use a minimal fallback from Firebase auth if Firestore user doc is unavailable.
      const finalUser: AuthUser = authUser || {
        uid: credential.user.uid,
        email: credential.user.email || email,
        displayName: credential.user.displayName || '',
        role: undefined, // Will be filled in when onSnapshot picks up the user doc
        assignedDivisionIds: [],
      };

      setUser(finalUser);
      setLoading(false);
      setLoadingProgress(100);
      setLoadingStage('');

      // Non-blocking: Initialize FCM, notify SW
      initializeFCM().catch(() => {});
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'AUTH_STATE_CHANGED',
          isLoggedIn: true,
          uid: finalUser.uid,
          tenantId: finalUser.tenantId,
          role: finalUser.role,
        });
      }
    } catch (error: any) {
      // Always clear loading state on error so UI isn't stuck
      setLoading(false);
      // Don't leak whether it's username-not-found vs wrong-password
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' ||
          error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
        throw new Error('Invalid credentials');
      }
      throw error;
    }
  }, [buildAuthUser]);

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
      localStorage.removeItem('__auth_user_uid');

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
    return isAdminOrManagerRole(user?.role);
  }, [user?.role]);

  const isPRO = useCallback(() => {
    return user?.role === 'PRO';
  }, [user]);

  const isSuperAdmin = useCallback(() => {
    return user?.role === 'SUPER_ADMIN';
  }, [user]);

  // Listen for auth state changes
  useEffect(() => {
    const currentVersion = ++authVersionRef.current;
    const initialCheckDone = { value: false };

    // Detect if this is a returning user (Firebase persisted session)
    // In that case, skip the heavy loading animation entirely
    const savedUser = localStorage.getItem('__auth_user_uid');
    if (savedUser && isInitialMount.current) {
      _skipLoadingScreen = true;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (currentVersion !== authVersionRef.current) return; // Stale handler

      if (firebaseUser) {
        try {
          // If user just logged in via login(), skip the full buildAuthUser cycle.
          // The login() function already set user and loading=false.
          if (_justLoggedIn) {
            _justLoggedIn = false;
            _skipLoadingScreen = false;
            initializeFCM().catch(() => {});
            setLoading(false);
            setLoadingProgress(100);
            setLoadingStage('');
            initialCheckDone.value = true;
            isInitialMount.current = false;
            return;
          }

          // For returning users (Firebase auto-login), show minimal loading
          if (_skipLoadingScreen) {
            _skipLoadingScreen = false;
            setLoadingProgress(60);
            setLoadingStage('Restoring session...');
          } else if (isInitialMount.current) {
            setLoadingProgress(30);
            setLoadingStage('Checking authentication...');
          }

          const authUser = await buildAuthUser(firebaseUser);

          if (currentVersion !== authVersionRef.current) return;

          if (authUser) {
            setUser(authUser);
            // Remember this user for faster loading on next visit
            localStorage.setItem('__auth_user_uid', authUser.uid);

            // Initialize FCM for push notifications — non-blocking
            initializeFCM().catch((e) => {
              console.warn('FCM initialization failed (non-critical):', e);
            });

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
            localStorage.removeItem('__auth_user_uid');
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        localStorage.removeItem('__auth_user_uid');
      }

      // Always set loading=false after processing auth state change.
      setLoading(false);
      setLoadingProgress(100);
      setLoadingStage('');
      initialCheckDone.value = true;
      isInitialMount.current = false;
    });

    // Safety timeout: if Firebase doesn't respond within 16 seconds,
    // (giving enough time for the 15-second getDoc timeout above)
    // force loading to false so the app isn't stuck forever.
    const safetyTimeout = setTimeout(() => {
      if (!initialCheckDone.value) {
        console.warn('Auth state change timed out — forcing loading=false');
        setLoading(false);
        setLoadingProgress(100);
        setLoadingStage('');
        initialCheckDone.value = true;
        isInitialMount.current = false;
      }
    }, 16000);

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [buildAuthUser]);

  // Real-time user doc updates via onSnapshot
  // Uses Firestore cache so it works even during claims sync window.
  // After initial cache read, automatically switches to server for live updates.
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe: Unsubscribe | undefined;
    try {
      const userRef = doc(db, 'users', user.uid);
      // { source: 'default' } lets Firestore SDK decide: cache-first if available,
      // then server. This avoids permission-denied when claims aren't synced yet
      // because the initial read comes from the cache populated by buildAuthUser.
      unsubscribe = onSnapshot(userRef, { source: 'default' }, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser(prev => prev ? {
            ...prev,
            displayName: data.displayName || prev.displayName,
            phone: data.phone || prev.phone,
            role: (data.role as Role) || prev.role,
            teamId: data.teamId !== undefined ? (data.teamId ?? null) : prev.teamId,
            tenantId: data.tenantId || prev.tenantId,
            assignedDivisionIds: Array.isArray(data.assignedDivisionIds) ? data.assignedDivisionIds : prev.assignedDivisionIds,
            username: data.username || prev.username,
          } : prev);
        }
      }, (error) => {
        // Silently handle permission-denied errors — claims may not be synced yet.
        // The user data was already fetched in buildAuthUser or set as fallback
        // in login(). This listener will recover automatically once claims sync.
      });
    } catch (e) {
      // Snapshot setup failed — non-critical, user doc was already fetched
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
  const { user, isAdminOrManager, ...rest } = useAuth();
  return { ...rest, user, isAdminOrManager };
}
