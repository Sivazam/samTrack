import { initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCNOdmucv2HATHD7Ir7-K18fCIwIpzQaeQ",
  authDomain: "samhitaadmissiontracker.firebaseapp.com",
  projectId: "samhitaadmissiontracker",
  storageBucket: "samhitaadmissiontracker.firebasestorage.app",
  messagingSenderId: "447402441846",
  appId: "1:447402441846:web:5d362655d464145e5a7357"
};

import { logger } from '@/lib/logger';

// Initialize Firebase with error handling
let app;
try {
  app = initializeApp(firebaseConfig);
  logger.success('Firebase initialized successfully');
} catch (error: any) {
  logger.error('Firebase initialization error', error);
  // If app already exists, use the existing one
  if (error?.code === 'app/duplicate-app') {
    app = initializeApp(firebaseConfig, 'secondary');
  } else {
    throw error;
  }
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore with IndexedDB persistence for offline support
export const db = typeof window !== 'undefined'
  ? (() => {
      try {
        return initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        // HMR or duplicate-init: fall back to existing instance
        return getFirestore(app);
      }
    })()
  : getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

// ─────────────────────────────────────────────────────────────────────────────
// Firestore SDK Internal-Assertion Recovery
// ─────────────────────────────────────────────────────────────────────────────
// The Firestore JS SDK occasionally throws non-recoverable internal assertions
// (e.g. "INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9/b815)") when its
// persistent IndexedDB cache gets out of sync with server-side index state — most
// commonly right after new indexes are deployed. The watch stream cannot recover
// once this happens; the only fix is to clear the cache and reload.
//
// We listen for these specific errors and auto-recover by clearing the
// Firestore IndexedDB databases and reloading the page (once per session).
if (typeof window !== 'undefined') {
  const RECOVERY_FLAG = '__firestore_recovery_attempted';
  const isFirestoreInternalAssertion = (msg?: string) =>
    !!msg && msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED');

  const recoverFromCacheCorruption = async () => {
    if (sessionStorage.getItem(RECOVERY_FLAG)) {
      // Already tried this session — don't infinite-loop reload.
      return;
    }
    sessionStorage.setItem(RECOVERY_FLAG, '1');
    try {
      logger.warn('⚠️ Firestore SDK internal assertion detected — clearing cache and reloading');
      // Best-effort: delete Firestore IndexedDB databases.
      if ('indexedDB' in window && (indexedDB as any).databases) {
        const dbs = await (indexedDB as any).databases();
        await Promise.all(
          (dbs || [])
            .filter((d: any) => d?.name && d.name.startsWith('firestore/'))
            .map((d: any) => new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(d.name);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }))
        );
      }
    } catch (e) {
      console.warn('Cache cleanup failed (continuing):', e);
    }
    window.location.reload();
  };

  window.addEventListener('error', (event) => {
    if (isFirestoreInternalAssertion(event.message) || isFirestoreInternalAssertion(event.error?.message)) {
      void recoverFromCacheCorruption();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (isFirestoreInternalAssertion(msg)) {
      void recoverFromCacheCorruption();
    }
  });
}

// Connect to Emulators in Development (Client-side only)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  try {
    console.log('🔧 Connecting to Firebase Emulators...');
    // We wrap EACH connection independently so one failure doesn't block others
    // try { connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); } catch (e) { console.debug('Auth emulator already connected/failed'); }
    // try { connectFirestoreEmulator(db, '127.0.0.1', 8080); } catch (e: any) { console.debug('Firestore emulator connection issue:', e.message); }
    // try { connectStorageEmulator(storage, '127.0.0.1', 9199); } catch (e) { console.debug('Storage emulator already connected/failed'); }

    console.log('✅ Emulator connection attempts finished');
  } catch (e) {
    console.warn('⚠️ Unexpected error connecting to emulators:', e);
  }
}

// Collection names
export const COLLECTIONS = {
  TENANTS: 'tenants',
  USERS: 'users',
  USERNAME_INDEX: 'usernameIndex',
  DIVISIONS: 'divisions',
  TEAMS: 'teams',
  LEADS: 'leads',
  STATUS_UPDATES: 'statusUpdates',
  LEAD_ASSIGNMENTS: 'leadAssignments',
  REMINDERS: 'reminders',
  TENANT_CONFIG: 'tenantConfig',
  IMPORT_BATCHES: 'importBatches',
  TENANT_STATS: 'tenant_stats',
  TENANT_DAILY_STATS: 'tenant_daily_stats',
  PROCESSED_EVENTS: '_processedEvents',
} as const;

// User roles
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COLLEGE_ADMIN: 'COLLEGE_ADMIN',
  MANAGER: 'MANAGER',
  PRO: 'PRO',
} as const;

// Tenant statuses
export const TENANT_STATUSES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;

// Approach types for lead engagement
export const APPROACH_TYPES = {
  PHONE: 'PHONE',
  DOORSTEP: 'DOORSTEP',
  WALK_IN: 'WALK_IN',
  ONLINE: 'ONLINE',
} as const;

// Reminder statuses
export const REMINDER_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  COMPLETED: 'COMPLETED',
  SNOOZED: 'SNOOZED',
  CANCELLED: 'CANCELLED',
} as const;

export default app;
