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
exports.registerFcmTokenHandler = registerFcmTokenHandler;
exports.unregisterFcmTokenHandler = unregisterFcmTokenHandler;
exports.markNotificationReadHandler = markNotificationReadHandler;
exports.sendStatusUpdateNotificationHandler = sendStatusUpdateNotificationHandler;
exports.sendReminderPushHandler = sendReminderPushHandler;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const utils_1 = require("./utils");
const db = admin.firestore();
const messaging = admin.messaging();
// Helper to send FCM to a list of UIDs
async function sendFCMToUids(uids, notification) {
    var _a;
    if (uids.length === 0)
        return;
    // Get FCM tokens for these UIDs
    const userDocs = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()));
    const tokens = [];
    for (const doc of userDocs) {
        if (!doc.exists)
            continue;
        const fcmDevices = ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.fcmDevices) || [];
        for (const device of fcmDevices) {
            if (device.isActive && device.token) {
                tokens.push(device.token);
            }
        }
    }
    if (tokens.length === 0)
        return;
    // Deduplicate by token prefix (reuse pHLynk pattern)
    const seenPrefixes = new Set();
    const uniqueTokens = tokens.filter(t => {
        const prefix = t.substring(0, 10);
        if (seenPrefixes.has(prefix))
            return false;
        seenPrefixes.add(prefix);
        return true;
    });
    // Send in batches of 500
    for (let i = 0; i < uniqueTokens.length; i += 500) {
        const batch = uniqueTokens.slice(i, i + 500);
        try {
            await messaging.sendEachForMulticast({
                tokens: batch,
                data: Object.assign(Object.assign({}, notification.data), { title: notification.title, body: notification.body }),
                android: { priority: 'high' },
                apns: { payload: { aps: { contentAvailable: true } } },
            });
        }
        catch (e) {
            console.error('FCM send error:', e);
        }
    }
}
async function registerFcmTokenHandler(payload, request) {
    var _a, _b;
    const token = await (0, utils_1.verifyAuthToken)(request);
    const { fcmToken, deviceId, userAgent, machineId } = payload;
    if (!fcmToken || !deviceId) {
        throw new functions.https.HttpsError('invalid-argument', 'fcmToken and deviceId required');
    }
    const uid = token.uid;
    const userRef = db.collection('users').doc(uid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    // Dedup: check if token prefix already registered
    const tokenPrefix = fcmToken.substring(0, 10);
    const userDoc = await userRef.get();
    const existingDevices = userDoc.exists ? (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmDevices) || []) : [];
    // Remove any existing device with same deviceId or same token prefix
    const filteredDevices = existingDevices.filter((d) => { var _a; return d.deviceId !== deviceId && !((_a = d.token) === null || _a === void 0 ? void 0 : _a.startsWith(tokenPrefix)); });
    const newDevice = {
        token: fcmToken,
        deviceId,
        userAgent: userAgent || '',
        lastActive: now,
        createdAt: now,
        isActive: true,
        machineId: machineId || null,
    };
    await userRef.update({
        fcmDevices: [...filteredDevices, newDevice],
        updatedAt: now,
    });
    // Also add to tenant fcmDevices for admin/manager
    const tenantId = token.tenantId;
    if (tenantId && (token.role === 'COLLEGE_ADMIN' || token.role === 'MANAGER')) {
        const tenantRef = db.collection('tenants').doc(tenantId);
        const tenantDoc = await tenantRef.get();
        if (tenantDoc.exists) {
            const tenantDevices = ((_b = tenantDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmDevices) || [];
            const filteredTenantDevices = tenantDevices.filter((d) => { var _a; return d.deviceId !== deviceId && !((_a = d.token) === null || _a === void 0 ? void 0 : _a.startsWith(tokenPrefix)); });
            await tenantRef.update({
                fcmDevices: [...filteredTenantDevices, newDevice],
                updatedAt: now,
            });
        }
    }
    return { success: true };
}
async function unregisterFcmTokenHandler(payload, request) {
    var _a, _b;
    const token = await (0, utils_1.verifyAuthToken)(request);
    const { deviceId } = payload;
    if (!deviceId)
        throw new functions.https.HttpsError('invalid-argument', 'deviceId required');
    const uid = token.uid;
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
        const devices = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmDevices) || [];
        // Remove ONLY the matching device (not mark inactive)
        const updatedDevices = devices.filter((d) => d.deviceId !== deviceId);
        await userRef.update({ fcmDevices: updatedDevices, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    // Also remove from tenant doc if admin/manager
    const tenantId = token.tenantId;
    if (tenantId && (token.role === 'COLLEGE_ADMIN' || token.role === 'MANAGER')) {
        const tenantRef = db.collection('tenants').doc(tenantId);
        const tenantDoc = await tenantRef.get();
        if (tenantDoc.exists) {
            const tenantDevices = ((_b = tenantDoc.data()) === null || _b === void 0 ? void 0 : _b.fcmDevices) || [];
            const updatedTenantDevices = tenantDevices.filter((d) => d.deviceId !== deviceId);
            await tenantRef.update({ fcmDevices: updatedTenantDevices, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
    }
    return { success: true };
}
async function markNotificationReadHandler(payload, request) {
    // Placeholder for in-app notification read status
    return { success: true };
}
async function sendStatusUpdateNotificationHandler(payload, request) {
    const { leadId, statusLabel, loggedByName, tenantId, loggedByUid, teamMemberUids } = payload;
    // Notify admins/managers + the OTHER teammate (not self)
    const adminManagerUids = [];
    const usersSnap = await db.collection('users')
        .where('tenantId', '==', tenantId)
        .where('active', '==', true)
        .get();
    for (const doc of usersSnap.docs) {
        const r = doc.data().role;
        if (r === 'COLLEGE_ADMIN' || r === 'MANAGER')
            adminManagerUids.push(doc.id);
    }
    const recipientUids = [...adminManagerUids, ...(teamMemberUids || []).filter((uid) => uid !== loggedByUid)];
    const uniqueUids = [...new Set(recipientUids)];
    await sendFCMToUids(uniqueUids, {
        title: 'Status Update',
        body: `${loggedByName} updated: ${statusLabel}`,
        data: { type: 'STATUS_UPDATE', leadId, clickAction: `/leads/${leadId}` },
    });
    return { success: true, notifiedCount: uniqueUids.length };
}
async function sendReminderPushHandler(payload, request) {
    const { recipientUids, leadId, leadDisplayName, note, reminderId } = payload;
    await sendFCMToUids(recipientUids || [], {
        title: 'Follow-up Reminder',
        body: `Follow-up due: ${leadDisplayName}${note ? ` — ${note}` : ''}`,
        data: { type: 'REMINDER', leadId, reminderId, clickAction: `/leads/${leadId}` },
    });
    return { success: true };
}
//# sourceMappingURL=notification-handlers.js.map