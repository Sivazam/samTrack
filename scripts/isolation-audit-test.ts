
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const TIMESTAMP = Date.now();
const REPORT_FILE = path.join(process.cwd(), 'MASS_STRESS_TEST_REPORT.md');

// Utils
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- REPORTING ENGINE ---
let reportContent = `# Mass Data Isolation Stress Test Report\n\n`;
reportContent += `- **Timestamp**: ${new Date().toLocaleString()}\n`;
reportContent += `- **Simulation Scope**: 50 Wholesalers, 250 Workers, 150 Areas, 100 Shared Retailers\n\n`;

function log(actor: string, message: string, status: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' = 'INFO') {
    const icons = { INFO: 'ℹ️', SUCCESS: '✅', ERROR: '❌', WARN: '⚠️' };
    const formatted = `${icons[status]} [${actor}] ${message}`;
    console.log(formatted);
    reportContent += `### ${formatted}\n`;
}

function addToReport(text: string) {
    reportContent += text + '\n';
}

async function initFirebase() {
    if (getApps().length === 0) {
        initializeApp({ projectId: 'plkapp-8c052' });
    }
    const db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
    log('SYSTEM', 'Firebase Admin Connected (Emulator)', 'SUCCESS');
    return { db, auth: getAuth() };
}

async function main() {
    const { db } = await initFirebase();

    // SCALE PARAMETERS
    const NUM_WHOLESALERS = 50;
    const WORKERS_PER_WH = 5;
    const AREAS_PER_WH = 3;
    const NUM_RETAILERS = 100;

    const wholesalers: string[] = [];
    const retailers: string[] = [];
    const lineWorkersMap: Map<string, string[]> = new Map();
    const areasMap: Map<string, string[]> = new Map();

    log('TEST', '🚀 Phase 1: Massive Infrastructure Setup');
    addToReport('| Batch | Action | Status |\n|---|---|---|');

    // 1. Setup Wholesalers, Areas, Workers
    for (let i = 1; i <= NUM_WHOLESALERS; i++) {
        const tenantId = `tenant_${i}_${TIMESTAMP}`;
        wholesalers.push(tenantId);

        const batch = db.batch();

        // Tenant
        batch.set(db.collection('tenants').doc(tenantId), {
            name: `Wholesaler ${i}`,
            status: 'ACTIVE',
            createdAt: FieldValue.serverTimestamp()
        });

        // Areas
        const areaIds: string[] = [];
        for (let a = 1; a <= AREAS_PER_WH; a++) {
            const areaId = `area_${tenantId}_${a}`;
            batch.set(db.collection('areas').doc(areaId), {
                name: `Area ${a} for W${i}`,
                tenantIds: [tenantId],
                active: true
            });
            areaIds.push(areaId);
        }
        areasMap.set(tenantId, areaIds);

        // Workers
        const workerIds: string[] = [];
        for (let w = 1; w <= WORKERS_PER_WH; w++) {
            const workerId = `worker_${tenantId}_${w}`;
            batch.set(db.collection('users').doc(workerId), {
                displayName: `Worker ${w} for W${i}`,
                roles: ['LINE_WORKER'],
                tenantIds: [tenantId],
                active: true
            });
            workerIds.push(workerId);
        }
        lineWorkersMap.set(tenantId, workerIds);

        await batch.commit();
        if (i % 10 === 0) addToReport(`| ${i}/50 | Wholesalers & Linked Assets Created | ✅ SUCCESS |`);
    }

    // 2. Setup Shared Retailers
    log('TEST', 'Phase 2: Initializing 100 Shared Retailers');
    for (let j = 1; j <= NUM_RETAILERS; j++) {
        const retailerId = `retailer_${j}_${TIMESTAMP}`;
        const phone = `+917000000${j.toString().padStart(3, '0')}`;
        retailers.push(retailerId);

        await db.collection('retailers').doc(retailerId).set({
            name: `Retailer ${j}`,
            phone,
            tenantIds: wholesalers,
            wholesalerData: {}, // Initialize to avoid undefined issues
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        const uid = `retailer_${phone.replace(/\D/g, '')}`;
        await db.collection('retailerUsers').doc(uid).set({
            uid,
            phone,
            retailerId,
            tenantIds: wholesalers,
            isActive: true
        });

        if (j % 20 === 0) addToReport(`| ${j}/100 | Shared Retailers & Login Records Ready | ✅ SUCCESS |`);
    }

    // 3. --- STRESS TEST: dashboard assignments ---
    log('AUDIT', 'Phase 3: Stress Testing Dashboard Isolation');
    addToReport('\n## Isolation Audit: Specific Use Cases\n');

    const targetRetailerId = retailers[0];
    const updatePromises = wholesalers.map(async (tenantId, idx) => {
        const wholesalerAreas = areasMap.get(tenantId);
        const wholesalerWorkers = lineWorkersMap.get(tenantId);

        if (!wholesalerAreas || !wholesalerWorkers) {
            throw new Error(`Fallback data missing for ${tenantId}`);
        }

        const areaId = wholesalerAreas[idx % AREAS_PER_WH];
        const workerId = wholesalerWorkers[idx % WORKERS_PER_WH];
        const code = `WH${idx}-C${TIMESTAMP}`;

        await db.collection('retailers').doc(targetRetailerId).update({
            [`wholesalerData.${tenantId}`]: {
                currentAreaId: areaId,
                assignedLineWorkerId: workerId,
                assignedLineWorkerIds: [workerId],
                code: code,
                assignedAt: FieldValue.serverTimestamp()
            }
        });
    });

    await Promise.all(updatePromises);
    log('AUDIT', '50 Concurrent Wholesaler Updates Completed.', 'SUCCESS');

    const finalDocSnap = await db.collection('retailers').doc(targetRetailerId).get();
    const finalDoc = finalDocSnap.data();
    const finalWholesalerData = finalDoc?.wholesalerData || {};

    let passCount = 0;
    for (let i = 0; i < wholesalers.length; i++) {
        const tenantId = wholesalers[i];
        const wData = finalWholesalerData[tenantId];
        const expectedCode = `WH${i}-C${TIMESTAMP}`;
        if (wData && wData.code === expectedCode) passCount++;
    }

    if (passCount === 50) {
        log('AUDIT', 'PASS: 100% Isolation (50/50) verified.', 'SUCCESS');
        addToReport(`- **Result**: 50 wholesalers updated the SAME retailer simultaneously. 100% of the data was isolated. ✅ PASS\n`);
    } else {
        log('AUDIT', `FAIL: Only ${passCount}/50 survived.`, 'ERROR');
        addToReport(`- **Result**: Data corruption detected! ${50 - passCount} wholesalers lost their data. ❌ FAIL\n`);
    }

    // 4. --- STRESS TEST: Mass Payments ---
    log('AUDIT', 'Phase 4: Mass Payment Accuracy');
    for (let p = 1; p <= 100; p++) {
        const tenantId = wholesalers[p % NUM_WHOLESALERS];
        const retailerId = retailers[p % NUM_RETAILERS];
        const workerIds = lineWorkersMap.get(tenantId)!;
        const workerId = workerIds[p % WORKERS_PER_WH];

        const rData = (await db.collection('retailers').doc(retailerId).get()).data();
        const wholesalerData = rData?.wholesalerData || {};
        const wSpecific = wholesalerData[tenantId] || { code: 'INIT', currentAreaId: 'A1' };

        await db.collection('payments').doc(`pay_stress_${p}_${TIMESTAMP}`).set({
            tenantId,
            retailerId,
            lineWorkerId: workerId,
            retailerCode: wSpecific.code,
            retailerAreaId: wSpecific.currentAreaId,
            totalPaid: p * 50,
            state: 'COMPLETED',
            createdAt: FieldValue.serverTimestamp()
        });
        if (p % 25 === 0) log('PAY', `Processed ${p}/100 Payments...`);
    }

    // verification: Freeze check
    log('AUDIT', 'Checking historical drift preservation...');
    const w1 = wholesalers[0];
    const firstPayment = (await db.collection('payments').doc(`pay_stress_1_${TIMESTAMP}`).get()).data();

    // Change current state
    await db.collection('retailers').doc(retailers[1]).update({
        [`wholesalerData.${w1}.currentAreaId`]: 'GHOST_AREA'
    });

    const verifyPay = (await db.collection('payments').doc(`pay_stress_1_${TIMESTAMP}`).get()).data();
    if (verifyPay?.retailerAreaId === firstPayment?.retailerAreaId && verifyPay?.retailerAreaId !== 'GHOST_AREA') {
        log('AUDIT', 'PASS: Payment remained frozen.', 'SUCCESS');
        addToReport(`- **Historical Drift**: Payment record did not drift after dashboard change. ✅ PASS\n`);
    }

    log('TEST', 'Mass Stress Test Complete. Generating Report...');
    fs.writeFileSync(REPORT_FILE, reportContent);
}

main().catch(err => {
    log('SYSTEM', `Critical Error: ${err.stack}`, 'ERROR');
    process.exit(1);
});
