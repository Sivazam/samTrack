'use client';

import { getMessaging, getToken as getFCMTokenFromFirebase, onMessage, deleteToken } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';
import { auth, firebaseConfig } from '@/lib/firebase';
import { storeCurrentDeviceToken, clearCurrentDeviceInfo, isCurrentDeviceRegistered, getCurrentDeviceInfo, getCurrentDeviceId, getMachineId } from '@/lib/device-manager';

// Initialize Firebase app for messaging
let firebaseApp: any = null;
let messagingInstance: any = null;

// Token refresh tracking — stores last-known token + user info for periodic re-validation
let _lastKnownToken: string | null = null;
let _lastKnownUserId: string | null = null;
let _lastKnownUserType: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants' | null = null;
let _tokenRefreshInterval: ReturnType<typeof setInterval> | null = null;
let _visibilityListenerAttached = false;

/**
 * Initialize Firebase app for messaging
 */
function initializeFirebaseApp() {
  if (!firebaseApp && typeof window !== 'undefined') {
    try {
      firebaseApp = initializeApp(firebaseConfig, 'fcm-app');
    } catch (error) {
      console.error('❌ Error initializing Firebase app for FCM:', error);
    }
  }
  return firebaseApp;
}

/**
 * Get Firebase Messaging instance
 */
export function getMessagingInstance() {
  if (!messagingInstance && typeof window !== 'undefined') {
    try {
      const app = initializeFirebaseApp();
      if (app) {
        messagingInstance = getMessaging(app);
      }
    } catch (error) {
      console.error('❌ Error creating Firebase Messaging instance:', error);
    }
  }
  return messagingInstance;
}

/**
 * Check if FCM is supported in the current environment
 */
export function isFCMSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  const hasSenderId = !!firebaseConfig.messagingSenderId;

  return (
    hasServiceWorker &&
    hasPushManager &&
    hasNotification &&
    hasSenderId &&
    (location.protocol === 'https:' || location.hostname === 'localhost')
  );
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isFCMSupported()) {
    throw new Error('Push notifications are not supported in this environment');
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    // Don't throw — just return 'denied' so callers can handle gracefully.
    // The getFCMToken() caller will return null, and initializeFCM() will
    // silently skip FCM setup. No scary console.error needed.
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    // Notification permission result (minimal logging)
    return permission;
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    throw error;
  }
}

/**
 * Force Service Worker update (temporary fix for FCM issues)
 * This will unregister all existing Service Workers and register with cache-busting
 */
export async function forceServiceWorkerUpdate(): Promise<{ success: boolean; message: string }> {
  // Ensure this only runs on client side
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      success: false,
      message: 'Service Workers not supported in this environment'
    };
  }

  try {
    console.log('🔄 Starting forced Service Worker update...');

    // Unregister the old separate FCM service worker if it still exists
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.active?.scriptURL.includes('firebase-messaging-sw')) {
        console.log('🗑️ Unregistering old FCM Service Worker:', registration.active?.scriptURL);
        await registration.unregister();
      }
    }

    // Register the unified service worker with cache-busting to force update
    const cacheBuster = Date.now();
    const swUrl = `/sw.js?v=${cacheBuster}`;

    const registration = await navigator.serviceWorker.register(swUrl);
    console.log('✅ New Service Worker registered with cache-buster:', swUrl);

    // Force the new service worker to activate
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    return {
      success: true,
      message: 'Service Worker updated successfully. Please refresh the page.'
    };

  } catch (error) {
    console.error('❌ Error forcing Service Worker update:', error);
    return {
      success: false,
      message: 'Failed to update Service Worker: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}

/**
 * Register service worker for FCM
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service workers are not supported');
    return null;
  }

  try {
    // Register the unified service worker (handles both PWA caching and FCM)
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (error) {
    console.error('❌ Error registering service worker:', error);
    return null;
  }
}

/**
 * Get FCM token
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    if (!isFCMSupported()) {
      console.warn('⚠️ FCM is not supported in this environment');
      return null;
    }

    // Request notification permission first
    const permission = await requestNotificationPermission();
    if (permission === 'denied') {
      // User has denied notifications — silently skip, no error needed
      return null;
    }

    // Register service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      console.warn('⚠️ Failed to register service worker');
      return null;
    }

    // Get messaging instance
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.warn('⚠️ Firebase Messaging instance not available');
      return null;
    }

    // Get VAPID key from environment or use placeholder
    const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || null;
    if (!vapidKey) {
      console.warn('⚠️ FCM VAPID key not configured - using token generation without VAPID');
      // Continue without VAPID key for testing
    }

    // Get FCM token — pass serviceWorkerRegistration so the SDK
    // doesn't auto-register /firebase-messaging-sw.js
    const tokenOptions: any = { serviceWorkerRegistration: registration };
    if (vapidKey) tokenOptions.vapidKey = vapidKey;

    let token: string | null = null;
    try {
      token = await getFCMTokenFromFirebase(messaging, tokenOptions);
    } catch (error: any) {
      const code = error?.code || error?.message || '';
      // Firebase SDK caches tokens in IndexedDB. If the cached token is stale,
      // getToken() tries to unsubscribe it from FCM servers and gets a 400.
      // Fix: clear the cached token from IndexedDB and retry.
      if (code.includes('token-unsubscribe-failed') || code.includes('token-subscribe-failed')) {
        console.warn('⚠️ Stale token in IndexedDB. Clearing FCM databases and retrying...');
        try {
          // Delete all firebase-messaging-* IndexedDB databases
          if ('databases' in indexedDB) {
            const dbs = await (indexedDB as any).databases();
            for (const dbInfo of dbs) {
              if (dbInfo.name && (dbInfo.name.includes('firebase-messaging') || dbInfo.name.includes('fcm'))) {
                console.log(`🗑️ Deleting IDB: ${dbInfo.name}`);
                indexedDB.deleteDatabase(dbInfo.name);
              }
            }
          } else {
            // Fallback: delete known database names
            (window.indexedDB as IDBFactory).deleteDatabase('firebase-messaging-database');
            (window.indexedDB as IDBFactory).deleteDatabase('firebase-messaging-store');
          }
          // Brief delay to let IDB deletions complete
          await new Promise(r => setTimeout(r, 500));
          // Retry — IDB is now empty, so SDK creates a fresh push subscription
          token = await getFCMTokenFromFirebase(messaging, tokenOptions);
          console.log('✅ FCM token obtained after IDB clear');
        } catch (retryError) {
          console.error('❌ Retry after IDB clear also failed:', retryError);
          return null;
        }
      } else {
        console.error('❌ Error getting FCM token:', error);
        return null;
      }
    }

    if (token) {
      return token;
    } else {
      return null;
    }
  } catch (error) {
    console.warn('FCM: getFCMToken failed:', (error as any)?.code || error);
    return null;
  }
}

/**
 * Initialize FCM and register device token
 */
export async function initializeFCM(
  userId?: string,
  userType?: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants'
): Promise<string | null> {
  try {
    if (!auth.currentUser) {
      // Silently return — user not authenticated yet
      return null;
    }

    // Smart user type detection
    let finalUserType = userType;
    if (!finalUserType) {
      const retailerId = localStorage.getItem('retailerId');
      if (retailerId) {
        finalUserType = 'retailers';
      } else {
        // Fallback for line workers and admins
        finalUserType = 'users';
      }
    }

    const finalUserId = userId || (finalUserType === 'retailers' ? localStorage.getItem('retailerId') : null) || auth.currentUser.uid;

    // Logging minimized for cleaner console output
    // console.log('🔧 Initializing FCM:', { uid: auth.currentUser.uid, finalUserId, type: finalUserType });

    // Get FCM token
    let token = await getFCMToken();

    if (!token) {
      // Token not available — likely notification permission denied or not supported
      // This is expected and not an error condition
      return null;
    }

    // Use provided userId or fall back to auth.currentUser.uid
    // (Already handled above with finalUserId and finalUserType)

    // Logging minimized for cleaner console

    // Validate that the user document exists before trying to update it
    const { doc, getDoc, updateDoc, setDoc, arrayUnion, Timestamp } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    const userRef = doc(db, finalUserType as any, finalUserId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // User doc not yet created (e.g. claims sync still in progress)
      // Store token locally and return — will be registered on next visit
      storeCurrentDeviceToken(token);
      return token;
    }

    // Check if token is already registered
    const isAlreadyRegistered = await checkIfTokenRegistered(token, userType, finalUserId);

    if (isAlreadyRegistered) {
      console.log('✅ FCM token already registered, updating last active');
      await updateLastActive(token, userType, finalUserId);
      return token;
    }

    // Token is valid (getToken succeeded, possibly after IDB-clear retry) but not yet
    // registered in the backend. Proceed directly to registration — no need to call
    // deleteToken() which would invalidate the valid token we just obtained.
    // Registering new token with Firestore user doc

    // Register new token with backend
    try {
      const userData = userDoc.data();
      let fcmDevices: any[] = userData.fcmDevices || [];
      const deviceId = getCurrentDeviceId();
      const now = Timestamp.now();
      const thirtyDaysAgoMs = Date.now() - (30 * 24 * 60 * 60 * 1000);

      // Processing device list for cleanup

      // 1. DEDUPLICATE AND CLEANUP
      // Deduplicate by DEVICE ID — each physical device should have exactly ONE entry
      // with its most recent token. Browsers generate new FCM tokens on SW restart,
      // cache clear, etc., so token-based dedup causes unbounded growth.
      const MAX_FCM_DEVICES = 15;
      const deviceMap = new Map(); // key: deviceId, value: device (most recent)

      fcmDevices.forEach(device => {
        if (!device.deviceId || !device.token) return;

        const lastActiveMs = device.lastActive?.toMillis?.() || new Date(device.lastActive).getTime();

        // Drop devices that are explicitly inactive AND older than 30 days
        if (device.isActive === false && lastActiveMs < thirtyDaysAgoMs) return;

        // Drop devices that haven't been active in 30 days (regardless of isActive flag)
        if (lastActiveMs < thirtyDaysAgoMs) return;

        const existing = deviceMap.get(device.deviceId);
        const existingMs = existing ? (existing.lastActive?.toMillis?.() || new Date(existing.lastActive).getTime()) : -1;

        // Keep the most recently active entry per deviceId
        if (!existing || lastActiveMs > existingMs) {
          deviceMap.set(device.deviceId, device);
        }
      });

      // 2. ADD/UPDATE CURRENT DEVICE (always overwrites entry for this deviceId)
      const existingForDevice = deviceMap.get(deviceId);
      const machineId = getMachineId();
      deviceMap.set(deviceId, {
        token: token,
        deviceId: deviceId,
        userAgent: navigator.userAgent,
        ...(machineId && { machineId }),
        lastActive: now,
        createdAt: existingForDevice?.createdAt || now,
        isActive: true
      });

      // 2b. DEDUP by token prefix (Installation ID) — the part before ':' identifies the
      // physical browser. Same browser regenerates tokens on SW restart/cache clear, but
      // the prefix stays the same. Without this, different deviceIds with same token prefix
      // cause duplicate notifications.
      // IMPORTANT: Runs AFTER step 2 so the current device (lastActive = now) always wins
      // over stale entries with the same browser prefix.
      const byTokenPrefix = new Map<string, string>(); // prefix → deviceId of most recent
      deviceMap.forEach((device, devId) => {
        if (!device.token) return;
        const colonIdx = device.token.indexOf(':');
        const prefix = colonIdx > 0 ? device.token.substring(0, colonIdx) : device.token;
        const existingDevId = byTokenPrefix.get(prefix);
        if (!existingDevId) {
          byTokenPrefix.set(prefix, devId);
        } else {
          const existingDev = deviceMap.get(existingDevId)!;
          const existMs = existingDev.lastActive?.toMillis?.() || new Date(existingDev.lastActive).getTime();
          const curMs = device.lastActive?.toMillis?.() || new Date(device.lastActive).getTime();
          if (curMs > existMs) {
            // Current device is newer — remove old, keep current
            deviceMap.delete(existingDevId);
            byTokenPrefix.set(prefix, devId);
          } else {
            // Existing is newer — remove current
            deviceMap.delete(devId);
          }
        }
      });

      // 2c. DEDUP by machineId — collapse different browsers on the same physical machine.
      // machineId is deterministic (screen + CPU + platform + language hash), so Chrome and Edge
      // on the same machine produce the same machineId. When a user opens ANY browser,
      // this cleans up entries from other browsers on the same machine.
      // Only runs if current device has a machineId (i.e., new client code).
      if (machineId) {
        const byMachineId = new Map<string, string>(); // machineId → deviceId of most recent
        deviceMap.forEach((device, devId) => {
          const mid = device.machineId;
          if (!mid) return; // Skip old entries without machineId — they'll be cleaned on next visit
          const existingDevId = byMachineId.get(mid);
          if (!existingDevId) {
            byMachineId.set(mid, devId);
          } else {
            const existingDev = deviceMap.get(existingDevId)!;
            const existMs = existingDev.lastActive?.toMillis?.() || new Date(existingDev.lastActive).getTime();
            const curMs = device.lastActive?.toMillis?.() || new Date(device.lastActive).getTime();
            if (curMs > existMs) {
              deviceMap.delete(existingDevId);
              byMachineId.set(mid, devId);
            } else {
              deviceMap.delete(devId);
            }
          }
        });
      }

      // 3. ENFORCE CAP — keep only the N most recently active devices
      let updatedDevices = Array.from(deviceMap.values());
      if (updatedDevices.length > MAX_FCM_DEVICES) {
        updatedDevices.sort((a, b) => {
          const aMs = a.lastActive?.toMillis?.() || new Date(a.lastActive).getTime();
          const bMs = b.lastActive?.toMillis?.() || new Date(b.lastActive).getTime();
          return bMs - aMs; // newest first
        });
        console.log(`🧹 Capping devices from ${updatedDevices.length} to ${MAX_FCM_DEVICES}`);
        updatedDevices = updatedDevices.slice(0, MAX_FCM_DEVICES);
      }

      await updateDoc(userRef, {
        fcmDevices: updatedDevices,
        updatedAt: now
      });

      // FCM device list updated successfully

      // NOTE: API backup call removed — it used a different deviceId algorithm
      // (hash of token:userAgent) than the direct write (localStorage random hash),
      // which caused guaranteed duplicate entries in fcmDevices on every registration.
      // The direct Firestore write above is the single source of truth.

      // Store current device info for proper logout handling
      storeCurrentDeviceToken(token);

      // Track token for refresh detection
      _lastKnownToken = token;
      _lastKnownUserId = finalUserId;
      _lastKnownUserType = finalUserType || null;
      setupTokenRefreshCheck();

      return token;
    } catch (backendError) {
      console.warn('FCM: Error storing token (non-critical):', (backendError as any)?.code || backendError);

      // Still store the token locally even if backend registration fails
      storeCurrentDeviceToken(token);
      _lastKnownToken = token;
      _lastKnownUserId = finalUserId;
      _lastKnownUserType = finalUserType || null;
      setupTokenRefreshCheck();
      return token;
    }
  } catch (error) {
    // Non-critical: FCM failure should never block the app
    console.warn('FCM init skipped:', (error as any)?.code || error);
    return null;
  }
}

/**
 * Setup periodic token refresh check.
 * Firebase can silently rotate tokens. This detects changes and updates Firestore.
 * Runs on:
 *  - visibilitychange → visible (user returns to tab/app)
 *  - Every hour via setInterval
 */
function setupTokenRefreshCheck(): void {
  if (typeof window === 'undefined') return;

  // Attach visibilitychange listener once
  if (!_visibilityListenerAttached) {
    _visibilityListenerAttached = true;
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await checkAndRefreshToken();
      }
    });
  }

  // Setup hourly interval (clear previous to prevent stacking)
  if (_tokenRefreshInterval) {
    clearInterval(_tokenRefreshInterval);
  }
  _tokenRefreshInterval = setInterval(async () => {
    await checkAndRefreshToken();
  }, 60 * 60 * 1000); // 1 hour
}

/**
 * Compare current FCM token against last-known. If different, re-register in Firestore.
 */
async function checkAndRefreshToken(): Promise<void> {
  if (!_lastKnownToken || !_lastKnownUserId || !_lastKnownUserType) return;
  if (!auth.currentUser) return;

  try {
    const currentToken = await getFCMToken();
    if (!currentToken) return;

    if (currentToken !== _lastKnownToken) {
      console.log('🔄 FCM token changed! Re-registering...', {
        oldPrefix: _lastKnownToken.substring(0, 15) + '...',
        newPrefix: currentToken.substring(0, 15) + '...'
      });
      // Re-run initializeFCM to update Firestore with the new token
      await initializeFCM(_lastKnownUserId, _lastKnownUserType);
    }
  } catch (e) {
    // Non-critical — log and continue
    console.warn('⚠️ Token refresh check failed:', e);
  }
}
/**
 * Re-initialize FCM using the last-known userId and userType.
 * Called when push subscription changes (desktop subscription expiry).
 * If no prior init happened, falls back to auto-detection.
 */
export async function reinitializeFCM(): Promise<string | null> {
  if (_lastKnownUserId && _lastKnownUserType) {
    return initializeFCM(_lastKnownUserId, _lastKnownUserType);
  }
  return initializeFCM();
}

/**
 * Check if token is already registered for this user
 */
async function checkIfTokenRegistered(
  token: string,
  userType?: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants',
  userId?: string
): Promise<boolean> {
  try {
    if (!auth.currentUser) return false;

    // Smart user type detection
    let finalUserType = userType;
    if (!finalUserType) {
      finalUserType = localStorage.getItem('retailerId') ? 'retailers' : 'users';
    }

    // Use provided userId or fall back to auth.currentUser.uid
    const finalUserId = userId || (finalUserType === 'retailers' ? localStorage.getItem('retailerId') : null) || auth.currentUser.uid;

    // Check directly in user document
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    const userRef = doc(db, finalUserType as any, finalUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const devices: any[] = userData.fcmDevices || [];
      return devices.some(device => device.token === token && device.isActive);
    }

    return false;
  } catch (error) {
    console.error('Error checking token registration:', error);
    return false;
  }
}

/**
 * Update last active timestamp for existing token
 */
async function updateLastActive(
  token: string,
  userType?: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants',
  userId?: string
): Promise<void> {
  try {
    if (!auth.currentUser) return;

    // Smart user type detection
    let finalUserType = userType;
    if (!finalUserType) {
      finalUserType = localStorage.getItem('retailerId') ? 'retailers' : 'users';
    }

    // Use provided userId or fall back to auth.currentUser.uid
    const finalUserId = userId || (finalUserType === 'retailers' ? localStorage.getItem('retailerId') : null) || auth.currentUser.uid;

    // Update directly in user document
    const { doc, getDoc, updateDoc, Timestamp } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    const userRef = doc(db, finalUserType as any, finalUserId);
    console.log(`🔐 FCM Debug: Attempting to update lastActive`, {
      path: userRef.path,
      userType,
      finalUserId,
      authUid: auth.currentUser?.uid,
      isMatch: finalUserId === auth.currentUser?.uid,
      tokenPrefix: token.substring(0, 10) + '...'
    });

    try {
      await updateDoc(userRef, {
        updatedAt: Timestamp.now()
      });
      console.log('✅ FCM: Simple timestamp update test passed');
    } catch (e) {
      console.error('❌ FCM: Simple timestamp update failed - PERMISSION ISSUE LIKELY', e);
    }

    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const devices: any[] = userData.fcmDevices || [];

      const updatedDevices = devices.map(device =>
        device.token === token
          ? { ...device, lastActive: Timestamp.now(), isActive: true }
          : device
      );

      await updateDoc(userRef, {
        fcmDevices: updatedDevices,
        updatedAt: Timestamp.now()
      });

      console.log('✅ Updated last active timestamp for FCM device');
    } else {
      console.warn('⚠️ User document does not exist for lastActive update:', userRef.path);
    }
  } catch (error) {
    console.error('Error updating last active:', error);
  }
}

/**
 * Listen for foreground messages
 */
export function onMessageListener() {
  const messaging = getMessagingInstance();

  if (!messaging) {
    console.warn('⚠️ Firebase Messaging instance not available for foreground messages');
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('📱 FCM foreground message received:', payload);
      resolve(payload);
    });

    // Return unsubscribe function for cleanup
    return unsubscribe;
  });
}

/**
 * Delete FCM token (for logout)
 */
export async function deleteFCMToken(
  userType: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants' = 'users',
  overrideUserId?: string
): Promise<boolean> {
  try {
    console.log('🗑️ Starting FCM token deletion process...');

    // Get current device info before deletion
    const deviceInfo = getCurrentDeviceInfo();
    if (deviceInfo) {
      console.log('📱 Current device info:', {
        deviceId: deviceInfo.deviceId,
        tokenPrefix: deviceInfo.token.substring(0, 20) + '...'
      });
    }

    const messaging = getMessagingInstance();
    if (!messaging) {
      console.warn('⚠️ Firebase Messaging instance not available for token deletion');
      return false;
    }

    // Get current token before attempting deletion
    let currentToken: string | null = null;
    try {
      currentToken = await getFCMToken();
      console.log('🔍 Current FCM token:', currentToken ? `${currentToken.substring(0, 20)}...` : 'null');
    } catch (tokenError) {
      console.warn('⚠️ Error getting current FCM token:', tokenError);
    }

    // Note: Firebase doesn't provide a direct way to delete tokens in the current SDK
    // Instead, we should unregister the device from our backend
    if (auth.currentUser && currentToken) {
      try {
        console.log('📡 Unregistering current device from backend...');

        // Use overrideUserId (e.g. tenantId for WA), fall back to retailerId or auth UID
        const userId = overrideUserId || localStorage.getItem('retailerId') || auth.currentUser.uid;

        // CRITICAL: Delete the FCM token from Firebase Messaging to kill the push
        // subscription. Without this, the browser keeps receiving pushes even after
        // the backend marks the device as inactive.
        try {
          await deleteToken(messaging);
          console.log('🗑️ Firebase Messaging token deleted (push subscription removed)');
        } catch (deleteErr) {
          console.warn('⚠️ Failed to delete Firebase Messaging token:', deleteErr);
          // Continue — backend deactivation is the fallback safety net
        }

        // Update user document directly to deactivate device
        const { doc, getDoc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');

        const userRef = doc(db, userType, userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const devices: any[] = userData.fcmDevices || [];

          const updatedDevices = devices.map(device =>
            device.token === currentToken
              ? { ...device, isActive: false, lastActive: Timestamp.now() }
              : device
          );

          await updateDoc(userRef, {
            fcmDevices: updatedDevices,
            updatedAt: Timestamp.now()
          });

          console.log('✅ Device deactivated in user document');
        }

        // NOTE: API backup call removed — direct Firestore write is the single
        // source of truth. The API uses a different deviceId algorithm which
        // causes inconsistencies.
      } catch (backendError) {
        console.warn('⚠️ Error unregistering device from backend:', backendError);
      }
    } else {
      console.warn('⚠️ No authenticated user or token available for unregistration');
    }

    // Clear current device info from localStorage
    clearCurrentDeviceInfo();

    // Note: No additional cleanup needed here as we only want to remove the current device
    // The cleanup API for all devices should only be called in specific scenarios
    console.log('✅ Current device unregistration completed');

    console.log('✅ FCM token deletion process completed');
    return true;
  } catch (error) {
    console.error('❌ Error deleting FCM token:', error);
    return false;
  }
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  return getNotificationPermission() === 'granted' && isFCMSupported();
}


/**
 * Force reset FCM token (delete and re-initialize)
 * PROPER RESET: Explicitly calls deleteToken() on messaging instance
 */
export async function forceResetFCM(
  userId?: string,
  userType: 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants' = 'retailers'
): Promise<{ success: boolean; oldToken?: string; newToken?: string; error?: string }> {
  try {
    console.log('🔄 Starting FORCED FCM reset...');
    const messaging = getMessagingInstance();

    if (!messaging) {
      return { success: false, error: 'Messaging instance not found' };
    }

    // 1. Get current token just for logging
    let oldToken: string | undefined;
    try {
      const current = await getFCMToken();
      if (current) oldToken = current;
    } catch (e) {
      console.warn('Could not get current token during reset', e);
    }

    // 2. Explicitly DELETE the token from Firebase Messaging
    // This tells FCM backend to invalidate this token instance
    try {
      await deleteToken(messaging);
      console.log('🗑️ Deleted token from Firebase Messaging');
    } catch (e) {
      console.error('❌ Error deleting token:', e);
      // Continue anyway - maybe it's already gone
    }

    // 3. Unregister service workers to be super safe
    await forceServiceWorkerUpdate();

    // 4. Clean up local storage
    clearCurrentDeviceInfo();

    // 5. Re-initialize (this will generate a NEW token)
    console.log('✨ Re-initializing FCM...');
    const newToken = await initializeFCM(userId, userType);

    if (newToken) {
      console.log('✅ FCM Force Reset Successful. New token:', newToken.substring(0, 20) + '...');
      if (oldToken && oldToken === newToken) {
        console.warn('⚠️ Warning: We got the SAME token back. User might need to clear browser data fully.');
      }
      return { success: true, oldToken, newToken };
    } else {
      return { success: false, error: 'Failed to generate new token' };
    }

  } catch (error) {
    console.error('❌ Force Reset failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Cleanup FCM on logout — deactivates current device and clears local state.
 * This is the proper logout flow: only removes the CURRENT device, not all devices.
 */
export async function cleanupFCM(): Promise<void> {
  try {
    await deleteFCMToken('users');
  } catch (e) {
    console.warn('FCM cleanup failed (non-critical):', e);
  }
  clearCurrentDeviceInfo();
}

// Export types for TypeScript