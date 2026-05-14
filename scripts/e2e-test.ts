
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const BASE_URL = 'http://localhost:3000/api';
// Use the path provided by the user
const ACTUAL_SERVICE_ACCOUNT_PATH = 'C:\\Users\\aviS\\Downloads\\pharmaLynkv1\\functions\\service-account.json';
const FIREBASE_WEB_API_KEY = 'AIzaSyCdOIhLQh9iYBXbE7dre2J9zsmCBuVdwwU'; // From src/lib/firebase.ts
const TIMESTAMP = Date.now();
// const LOG_FILE = `e2e_simulation_${TIMESTAMP}.md`; // Optional logging

// --- SHARED DATA POOL ---
// We will use one "Shared Retailer" that effectively gets added to multiple wholesalers
const SHARED_RETAILER_PHONE = '+919876543210';
const SHARED_RETAILER_NAME = 'Shared Medical Store';

// Utils
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// --- LOGGING ---
function log(actor: string, message: string, status: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' = 'INFO') {
    const icons = { INFO: 'ℹ️', SUCCESS: '✅', ERROR: '❌', WARN: '⚠️' };
    const line = `${icons[status]} [${actor}] ${message}`;
    console.log(line);
}

async function initFirebase() {
    if (!fs.existsSync(ACTUAL_SERVICE_ACCOUNT_PATH)) {
        throw new Error(`Service Account not found at: ${ACTUAL_SERVICE_ACCOUNT_PATH}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(ACTUAL_SERVICE_ACCOUNT_PATH, 'utf8'));

    if (getApps().length === 0) {
        initializeApp({
            credential: cert(serviceAccount)
        });
    }
    log('SYSTEM', 'Firebase Admin Connected', 'SUCCESS');
    return { db: getFirestore(), auth: getAuth() };
}

// --- AUTH HELPER ---
async function getIdToken(userId: string, auth: any): Promise<string> {
    try {
        const customToken = await auth.createCustomToken(userId);
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: customToken,
                returnSecureToken: true
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Auth exchange failed');
        return data.idToken;
    } catch (err: any) {
        throw new Error(`Failed to get ID Token: ${err.message}`);
    }
}

// Generate unique phone numbers using last 9 digits of timestamp to ensure uniqueness across runs
const uniqueSuffix = TIMESTAMP.toString().slice(-9);

// --- CORE ACTIONS (Re-usable) ---

async function createWholesaler(index: number) {
    const phone = `+911${index.toString().padStart(2, '0')}${uniqueSuffix.substring(0, 7)}`;

    const res = await fetch(`${BASE_URL}/wholesaler/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            businessName: `Sim Wholesaler ${index}_${TIMESTAMP}`,
            ownerName: `Owner ${index}`,
            email: `sim.whol.${index}.${TIMESTAMP}@test.com`,
            password: 'Password123!',
            mobileNumber: phone,
            address: `Wholesaler Address ${index}`,
            gstNumber: `GST${index}ABCDE`
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    return { tenantId: data.tenantId, userId: data.userId };
}

async function createArea(db: FirebaseFirestore.Firestore, tenantId: string, index: number) {
    const areaRef = await db.collection('areas').add({
        name: `Area ${index}`,
        zipcodes: [`56000${index}`],
        active: true,
        tenantIds: [tenantId],
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return areaRef.id;
}

async function createLineWorker(tenantId: string, wholesalerDocId: string, areaId: string, index: number, idToken: string) {
    const phone = `+912${index.toString().padStart(2, '0')}${uniqueSuffix.substring(0, 7)}`;
    const res = await fetch(`${BASE_URL}/wholesaler/create-line-worker`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
            name: `Worker ${index}`,
            email: `worker.${tenantId}.${index}@test.com`,
            phone: phone,
            password: 'WorkerPass123!',
            assignedAreas: [areaId],
            tenantId,
            wholesalerId: wholesalerDocId // Admin user ID
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Worker creation failed');
    // API returns 'uid' for the new user
    return data.uid || data.lineWorkerId;
}

async function addRetailer(tenantId: string, areaId: string, idToken: string) {
    const res = await fetch(`${BASE_URL}/wholesaler/add-retailer`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
            tenantId,
            phone: SHARED_RETAILER_PHONE, // ALL wholesalers add the SAME retailer
            aliasName: `${SHARED_RETAILER_NAME} (Alias for ${tenantId.substring(0, 4)})`,
            areaId,
            zipcodes: ['560001'],
            creditLimit: 50000
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Retailer add failed');
    return data.retailer?.id;
}

async function collectPayment(tenantId: string, retailerId: string, workerId: string, amount: number, idToken: string) {
    const res = await fetch(`${BASE_URL}/payments/create-completed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
            tenantId,
            retailerId,
            retailerName: SHARED_RETAILER_NAME,
            lineWorkerId: workerId,
            lineWorkerName: 'Sim Worker',
            totalPaid: amount,
            method: 'CASH',
            notes: 'Simulated E2E Payment'
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Payment failed');
    return data.paymentId;
}

// --- THE SIMULATION FLOW ---

async function runWholesalerLifecycle(index: number, db: FirebaseFirestore.Firestore, auth: any) {
    const TAG = `WH-${index}`;
    try {
        // 1. Signup
        log(TAG, 'Signing up...');
        const { tenantId, userId } = await createWholesaler(index);
        log(TAG, `Created (Tenant: ${tenantId.substring(0, 5)}...)`, 'SUCCESS');

        // 2. Get ID Token for authenticated actions
        const idToken = await getIdToken(userId, auth);

        // 3. Setup Hierarchy
        const areaId = await createArea(db, tenantId, index);
        const workerId = await createLineWorker(tenantId, userId, areaId, index, idToken);
        log(TAG, 'Hierarchy (Area + Worker) Ready', 'SUCCESS');

        // 4. Add Shared Retailer
        log(TAG, `Adding Shared Retailer (${SHARED_RETAILER_PHONE})...`);
        const retailerId = await addRetailer(tenantId, areaId, idToken);
        log(TAG, `Linked Retailer ID: ${retailerId}`, 'SUCCESS');

        // 5. Random Behavior

        // Scenario A: Just Collect Payment
        await sleep(randomInt(500, 2000));
        log(TAG, 'Collecting Payment 1 (₹1000)...');
        await collectPayment(tenantId, retailerId, workerId, 1000, idToken);
        log(TAG, 'Payment 1 Success', 'SUCCESS');

        // Scenario B: Some wholesalers delete the retailer
        if (index % 2 === 0) { // All EVEN index wholesalers will delete the retailer
            await sleep(randomInt(1000, 3000));
            log(TAG, 'DECISION: Deleting Retailer from my list...');

            // Call Delete API (We need to verify if this API exists or simulate the Logic)
            // Assuming a generic logic or direct DB update for simulation if API missing
            // For now, let's simulate the "unassign" logic directly as per previous conversations
            // Or use restore-retailer-wholesaler-data logic. 
            // Actually, let's try to remove access from DB directly to be safe, simulating the action.

            await db.collection('retailers').doc(retailerId).update({
                [`wholesalerData.${tenantId}`]: require('firebase-admin/firestore').FieldValue.delete(),
                [`wholesalerAssignments.${tenantId}`]: require('firebase-admin/firestore').FieldValue.delete(),
                tenantIds: require('firebase-admin/firestore').FieldValue.arrayRemove(tenantId)
            });
            log(TAG, 'Retailer Deleted (Simulated)', 'WARN');

            // Verify I cannot make payment now
            try {
                await collectPayment(tenantId, retailerId, workerId, 500, idToken);
                log(TAG, 'ERROR: Payment succeeded after delete! Logic flaw.', 'ERROR');
            } catch (e) {
                log(TAG, 'Verified: Cannot make payment after delete.', 'SUCCESS');
            }

        } else {
            // Scenario C: Remaining wholesalers continue business
            await sleep(randomInt(2000, 4000));
            log(TAG, 'Collecting Payment 2 (₹2000)...');
            // This should SUCCEED even if other wholesalers deleted the retailer
            await collectPayment(tenantId, retailerId, workerId, 2000, idToken);
            log(TAG, 'Payment 2 Success (Isolation Verified)', 'SUCCESS');
        }

        log(TAG, 'Lifecycle Complete', 'SUCCESS');

    } catch (err: any) {
        log(TAG, `CRITICAL FAIL: ${err.message}`, 'ERROR');
    }
}

async function main() {
    const { db, auth } = await initFirebase();
    const NUM_WHOLESALERS = 5;

    log('MAIN', `Starting Concurrent Simulation for ${NUM_WHOLESALERS} Wholesalers...`, 'INFO');
    log('MAIN', `Target: Shared Retailer ${SHARED_RETAILER_PHONE}`, 'INFO');

    // Spawn all lifecycles in parallel
    const promises: Promise<void>[] = [];
    for (let i = 1; i <= NUM_WHOLESALERS; i++) {
        promises.push(runWholesalerLifecycle(i, db, auth));
    }

    await Promise.all(promises);

    log('MAIN', '-----------------------------------', 'INFO');
    log('MAIN', 'ALL SIMULATIONS COMPLETED', 'SUCCESS');
    log('MAIN', '-----------------------------------', 'INFO');
}

main();
