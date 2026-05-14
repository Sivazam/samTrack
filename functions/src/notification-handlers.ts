import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { verifyAuthToken } from './utils';

const db = admin.firestore();
const messaging = admin.messaging();

// Helper to send FCM to a list of UIDs
async function sendFCMToUids(uids: string[], notification: { title: string; body: string; data?: Record<string, string> }): Promise<void> {
  if (uids.length === 0) return;

  // Get FCM tokens for these UIDs
  const userDocs = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()));
  const tokens: string[] = [];

  for (const doc of userDocs) {
    if (!doc.exists) continue;
    const fcmDevices = doc.data()?.fcmDevices || [];
    for (const device of fcmDevices) {
      if (device.isActive && device.token) {
        tokens.push(device.token);
      }
    }
  }

  if (tokens.length === 0) return;

  // Deduplicate by token prefix (reuse pHLynk pattern)
  const seenPrefixes = new Set<string>();
  const uniqueTokens = tokens.filter(t => {
    const prefix = t.substring(0, 10);
    if (seenPrefixes.has(prefix)) return false;
    seenPrefixes.add(prefix);
    return true;
  });

  // Send in batches of 500
  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const batch = uniqueTokens.slice(i, i + 500);
    try {
      await messaging.sendEachForMulticast({
        tokens: batch,
        data: {
          ...notification.data,
          title: notification.title,
          body: notification.body,
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { contentAvailable: true } } },
      });
    } catch (e) {
      console.error('FCM send error:', e);
    }
  }
}

export async function registerFcmTokenHandler(payload: any, request: any) {
  const token = await verifyAuthToken(request);
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
  const existingDevices: any[] = userDoc.exists ? (userDoc.data()?.fcmDevices || []) : [];

  // Remove any existing device with same deviceId or same token prefix
  const filteredDevices = existingDevices.filter((d: any) => d.deviceId !== deviceId && !d.token?.startsWith(tokenPrefix));

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
      const tenantDevices: any[] = tenantDoc.data()?.fcmDevices || [];
      const filteredTenantDevices = tenantDevices.filter((d: any) => d.deviceId !== deviceId && !d.token?.startsWith(tokenPrefix));
      await tenantRef.update({
        fcmDevices: [...filteredTenantDevices, newDevice],
        updatedAt: now,
      });
    }
  }

  return { success: true };
}

export async function unregisterFcmTokenHandler(payload: any, request: any) {
  const token = await verifyAuthToken(request);
  const { deviceId } = payload;
  if (!deviceId) throw new functions.https.HttpsError('invalid-argument', 'deviceId required');

  const uid = token.uid;
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (userDoc.exists) {
    const devices: any[] = userDoc.data()?.fcmDevices || [];
    const updatedDevices = devices.map((d: any) =>
      d.deviceId === deviceId ? { ...d, isActive: false } : d
    );
    await userRef.update({ fcmDevices: updatedDevices, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  return { success: true };
}

export async function markNotificationReadHandler(payload: any, request: any) {
  // Placeholder for in-app notification read status
  return { success: true };
}

export async function sendStatusUpdateNotificationHandler(payload: any, request: any) {
  const { leadId, statusLabel, loggedByName, tenantId, loggedByUid, teamMemberUids } = payload;

  // Notify admins/managers + the OTHER teammate (not self)
  const adminManagerUids: string[] = [];
  const usersSnap = await db.collection('users')
    .where('tenantId', '==', tenantId)
    .where('active', '==', true)
    .get();
  for (const doc of usersSnap.docs) {
    const r = doc.data().role;
    if (r === 'COLLEGE_ADMIN' || r === 'MANAGER') adminManagerUids.push(doc.id);
  }

  const recipientUids = [...adminManagerUids, ...(teamMemberUids || []).filter((uid: string) => uid !== loggedByUid)];
  const uniqueUids = [...new Set(recipientUids)];

  await sendFCMToUids(uniqueUids, {
    title: 'Status Update',
    body: `${loggedByName} updated: ${statusLabel}`,
    data: { type: 'STATUS_UPDATE', leadId, clickAction: `/leads/${leadId}` },
  });

  return { success: true, notifiedCount: uniqueUids.length };
}

export async function sendReminderPushHandler(payload: any, request: any) {
  const { recipientUids, leadId, leadDisplayName, note, reminderId } = payload;

  await sendFCMToUids(recipientUids || [], {
    title: 'Follow-up Reminder',
    body: `Follow-up due: ${leadDisplayName}${note ? ` — ${note}` : ''}`,
    data: { type: 'REMINDER', leadId, reminderId, clickAction: `/leads/${leadId}` },
  });

  return { success: true };
}
