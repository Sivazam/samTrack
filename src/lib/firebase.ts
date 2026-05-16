import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
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

// Initialize Firebase — reuse the existing default app during HMR/module reloads
// instead of creating a broken 'secondary' named app.
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

logger.success('Firebase app ready');

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);


// Initialize Cloud Firestore.
// experimentalForceLongPolling forces the SDK to use plain HTTP long-polling
// instead of the default WebChannel/streaming transport. WebChannel is blocked
// by many corporate networks, ISPs, browser extensions, and some localhost
// setups — producing the exact symptom of "reads/writes hang while Auth (REST)
// works fine". experimentalAutoDetectLongPolling lets the SDK pick the best
// transport automatically (WebChannel when available, long-polling as fallback).
// Forcing long-polling via experimentalForceLongPolling caused out-of-order
// watch stream messages which triggered INTERNAL ASSERTION FAILED (ve:-1).
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    } as any);
  } catch {
    // Already initialized (e.g. HMR) — return the existing instance.
    return getFirestore(app);
  }
})();

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);



// Connect to Emulators in Development (Client-side only)
// Note: Emulator connections are disabled — uncomment the relevant lines to enable
// if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
//   connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
//   connectFirestoreEmulator(db, '127.0.0.1', 8080);
//   connectStorageEmulator(storage, '127.0.0.1', 9199);
// }

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
