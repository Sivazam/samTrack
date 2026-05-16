"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupStaleReminders = exports.processDailyReminders = exports.processReminders = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const messaging = admin.messaging();
// Helper to send FCM to UIDs
async function sendFCMToUids(uids, title, body, data = {}) {
    var _a;
    if (uids.length === 0)
        return;
    const userDocs = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()));
    const tokens = [];
    for (const doc of userDocs) {
        if (!doc.exists)
            continue;
        const devices = ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.fcmDevices) || [];
        for (const d of devices) {
            if (d.isActive && d.token)
                tokens.push(d.token);
        }
    }
    if (tokens.length === 0)
        return;
    for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        try {
            await messaging.sendEachForMulticast({
                tokens: batch,
                data: Object.assign(Object.assign({}, data), { title, body }),
                android: { priority: 'high' },
                apns: { payload: { aps: { contentAvailable: true } } },
            });
        }
        catch (e) {
            console.error('Scheduled FCM error:', e);
        }
    }
}
// Process time-specific reminders every 5 minutes
exports.processReminders = functions
    .region('asia-south1')
    .pubsub.schedule('every 5 minutes')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection('reminders')
        .where('status', '==', 'PENDING')
        .where('dueDateOnly', '==', false)
        .where('dueAt', '<=', now)
        .limit(100)
        .get();
    if (snapshot.empty)
        return null;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        await sendFCMToUids(data.recipientUids || [], 'Follow-up Reminder', `Follow-up due: ${data.leadDisplayName}${data.note ? ` — ${data.note}` : ''}`, { type: 'REMINDER', leadId: data.leadId, reminderId: doc.id, clickAction: `/leads/${data.leadId}` });
        await doc.ref.update({ status: 'SENT', sentAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return null;
});
// Process date-only reminders daily at 10 AM IST
exports.processDailyReminders = functions
    .region('asia-south1')
    .pubsub.schedule('0 10 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection('reminders')
        .where('status', '==', 'PENDING')
        .where('dueDateOnly', '==', true)
        .where('dueAt', '<=', now)
        .limit(500)
        .get();
    if (snapshot.empty)
        return null;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        await sendFCMToUids(data.recipientUids || [], 'Daily Follow-up Reminder', `Follow-up today: ${data.leadDisplayName}${data.note ? ` — ${data.note}` : ''}`, { type: 'REMINDER', leadId: data.leadId, reminderId: doc.id, clickAction: `/leads/${data.leadId}` });
        await doc.ref.update({ status: 'SENT', sentAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    return null;
});
// Cleanup stale reminders daily at 2 AM IST
exports.cleanupStaleReminders = functions
    .region('asia-south1')
    .pubsub.schedule('0 2 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const cutoff = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);
    const statuses = ['SENT', 'COMPLETED', 'CANCELLED'];
    let deleted = 0;
    for (const status of statuses) {
        const snapshot = await db.collection('reminders')
            .where('status', '==', status)
            .where('updatedAt', '<=', cutoff)
            .limit(100)
            .get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        if (!snapshot.empty)
            await batch.commit();
        deleted += snapshot.size;
    }
    // Recompute followupsDueToday for all tenants
    const tenantsSnap = await db.collection('tenants').where('status', '==', 'ACTIVE').get();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;
        const dueReminders = await db.collection('reminders')
            .where('tenantId', '==', tenantId)
            .where('status', 'in', ['PENDING', 'SENT'])
            .where('dueAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
            .where('dueAt', '<', admin.firestore.Timestamp.fromDate(endOfDay))
            .get();
        await db.collection('tenant_stats').doc(tenantId).set({
            followupsDueToday: dueReminders.size,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    console.log(`Cleanup: deleted ${deleted} stale reminders`);
    return null;
});
//# sourceMappingURL=scheduled-jobs.js.map