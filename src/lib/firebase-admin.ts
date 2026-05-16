import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { getAuth, Auth } from 'firebase-admin/auth'; // Import Admin Auth
import fs from 'fs';
import path from 'path';

// Define service account interface
interface ServiceAccount {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

// Flags to track initialization status
let adminApp: App | null = null;
let firestore: Firestore | null = null;
let messaging: Messaging | null = null;
let auth: Auth | null = null; // Track Auth instance

/**
 * Initialize Firebase Admin SDK
 * Tries to use environment variable first, then looks for local file
 */
export function initializeFirebaseAdmin(): App {
  if (adminApp) return adminApp;

  const validApps = getApps();
  if (validApps.length > 0) {
    adminApp = validApps[0];
    return adminApp!;
  }

  try {
    let serviceAccount: ServiceAccount | null = null;
    let source: string = 'none';

    // 1. Try Environment Variable (Vercel / Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        source = 'FIREBASE_SERVICE_ACCOUNT_KEY (env)';
      } catch (e: any) {
        console.error('❌ Admin SDK Error: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON. Ensure it is a valid JSON string without extra spaces/newlines.');
      }
    }

    // 2. Try Local File (Dev fallback) — check scripts/ then functions/
    if (!serviceAccount) {
      const localPaths = [
        path.join(process.cwd(), 'scripts', 'service-account-key.json'),
        path.join(process.cwd(), 'functions', 'service-account.json'),
      ];
      for (const serviceAccountPath of localPaths) {
        try {
          if (fs.existsSync(serviceAccountPath)) {
            console.log(`📂 Found local service account file at: ${serviceAccountPath}`);
            const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
            serviceAccount = JSON.parse(fileContent);
            source = `local json file (${serviceAccountPath})`;
            break;
          }
        } catch (e) {
          // Ignore errors, try next path
        }
      }
    }

    // 3. Try individual env vars (Individual fields)
    if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      };
      source = 'individual env vars';
    }

    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        // CRITICAL: Explicitly specify projectId to prevent 401 mismatches if env isn't detected
        projectId: serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID || 'samhitaadmissiontracker'
      });
      console.log(`✅ Firebase Admin initialized via ${source} for project: ${adminApp.options.projectId}`);
    } else {
      // 4. Automatic Initialization (GCP environment)
      try {
        adminApp = initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'samhitaadmissiontracker',
        });
        console.log('✅ Firebase Admin initialized with default credentials (GCP)');
      } catch (e: any) {
        console.error('❌ Firebase Admin Critical Error: No credentials found. Add FIREBASE_SERVICE_ACCOUNT_KEY to Vercel.');
        throw new Error('No service account credentials found.');
      }
    }

    return adminApp;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    throw error;
  }
}

export function getFirebaseFirestore(): Firestore {
  if (firestore) return firestore;
  const app = initializeFirebaseAdmin();
  firestore = getFirestore(app);
  return firestore;
}

export function getFirebaseMessaging(): Messaging {
  if (messaging) return messaging;
  const app = initializeFirebaseAdmin();
  messaging = getMessaging(app);
  return messaging;
}

export function getFirebaseAuth(): Auth { // Export Admin Auth
  if (auth) return auth;
  const app = initializeFirebaseAdmin();
  auth = getAuth(app);
  return auth;
}

export function checkFirebaseAdminStatus() {
  try {
    const app = initializeFirebaseAdmin();
    return { initialized: true, name: app.name };
  } catch (e: any) {
    return { initialized: false, error: e.message };
  }
}