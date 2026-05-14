import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isAlreadyProcessed, buildLeadAssignmentSearchFields } from './utils';

const db = admin.firestore();

// ─── onLeadCreated ────────────────────────────────────────────────────
export const onLeadCreated = functions.firestore
  .document('leads/{leadId}')
  .onCreate(async (snap, context) => {
    const lead = snap.data();
    const tenantId = lead.tenantId;
    const leadId = snap.id;

    // Increment tenant_stats
    const statsRef = db.collection('tenant_stats').doc(tenantId);
    await statsRef.set({
      totalLeads: admin.firestore.FieldValue.increment(1),
      totalActiveLeads: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Ensure leadAssignment exists
    const assignmentId = `${tenantId}__${leadId}`;
    const assignmentRef = db.collection('leadAssignments').doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      const searchFields = buildLeadAssignmentSearchFields(lead);
      await assignmentRef.set({
        tenantId,
        leadId,
        teamId: lead.teamId || null,
        assignedPROUids: lead.assignedPROUids || [],
        ...searchFields,
        lastStatusCode: lead.lastStatusCode || null,
        nextFollowupAt: lead.nextFollowupAt || null,
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// ─── onLeadUpdated ────────────────────────────────────────────────────
export const onLeadUpdated = functions.firestore
  .document('leads/{leadId}')
  .onUpdate(async (change, context) => {
    const eventId = `leadUpdate_${context.params.leadId}_${change.after.updateTime?.seconds || Date.now()}`;
    if (await isAlreadyProcessed(db, eventId)) return;

    const before = change.before.data();
    const after = change.after.data();
    const leadId = context.params.leadId;
    const tenantId = after.tenantId;

    // Check if name/phone/address/division/team changed
    const fieldsChanged = ['parentName', 'studentName', 'parentPhone', 'studentPhone', 'divisionId', 'divisionName', 'teamId', 'assignedPROUids', 'active', 'lastStatusCode', 'nextFollowupAt'];
    const needsSync = fieldsChanged.some(f => JSON.stringify(before[f]) !== JSON.stringify(after[f]));

    if (!needsSync) return;

    // Sync to leadAssignments
    const assignmentId = `${tenantId}__${leadId}`;
    const assignmentRef = db.collection('leadAssignments').doc(assignmentId);
    const searchFields = buildLeadAssignmentSearchFields(after);

    await assignmentRef.set({
      tenantId,
      leadId,
      teamId: after.teamId || null,
      assignedPROUids: after.assignedPROUids || [],
      ...searchFields,
      lastStatusCode: after.lastStatusCode || null,
      nextFollowupAt: after.nextFollowupAt || null,
      active: after.active !== false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Update active lead counts if active status changed
    if (before.active !== after.active) {
      const statsRef = db.collection('tenant_stats').doc(tenantId);
      await statsRef.set({
        totalActiveLeads: admin.firestore.FieldValue.increment(after.active ? 1 : -1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });

// ─── onLeadDeleted ────────────────────────────────────────────────────
export const onLeadDeleted = functions.firestore
  .document('leads/{leadId}')
  .onDelete(async (snap, context) => {
    const lead = snap.data();
    const tenantId = lead.tenantId;
    const leadId = context.params.leadId;

    // Decrement stats
    const statsRef = db.collection('tenant_stats').doc(tenantId);
    await statsRef.set({
      totalLeads: admin.firestore.FieldValue.increment(-1),
      totalActiveLeads: admin.firestore.FieldValue.increment(lead.active ? -1 : 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Delete assignment
    await db.collection('leadAssignments').doc(`${tenantId}__${leadId}`).delete();
  });

// ─── onStatusUpdateCreated ────────────────────────────────────────────
export const onStatusUpdateCreated = functions.firestore
  .document('leads/{leadId}/statusUpdates/{updateId}')
  .onCreate(async (snap, context) => {
    const eventId = `statusUpdate_${context.params.leadId}_${context.params.updateId}`;
    if (await isAlreadyProcessed(db, eventId)) return;

    const data = snap.data();
    const tenantId = data.tenantId;
    const leadId = context.params.leadId;

    // Update daily stats
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
    const dailyStatsId = `${tenantId}__${today}`;
    const dailyRef = db.collection('tenant_daily_stats').doc(dailyStatsId);
    const updatesCount = admin.firestore.FieldValue.increment(1);
    const byApproach: Record<string, any> = {};
    byApproach[`byApproachType.${data.approachType}`] = admin.firestore.FieldValue.increment(1);
    const byPRO: Record<string, any> = {};
    byPRO[`byPROUid.${data.loggedByUid}`] = admin.firestore.FieldValue.increment(1);
    if (data.teamId) {
      byPRO[`byTeamId.${data.teamId}`] = admin.firestore.FieldValue.increment(1);
    }

    await dailyRef.set({
      tenantId,
      date: today,
      updatesCount,
      byApproachType: { PHONE: 0, DOORSTEP: 0, WALK_IN: 0, ONLINE: 0 },
      byPROUid: {},
      byTeamId: {},
      remindersFired: 0,
      remindersCompleted: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...byApproach,
      ...byPRO,
    }, { merge: true });

    // Increment updatesCount properly
    await dailyRef.update({ updatesCount: admin.firestore.FieldValue.increment(1) });

    // Trigger push notification (call notification handler logic)
    try {
      const leadDoc = await db.collection('leads').doc(leadId).get();
      if (leadDoc.exists) {
        const leadData = leadDoc.data()!;
        // Import and call sendStatusUpdateNotification
        const { sendStatusUpdateNotificationHandler } = await import('./notification-handlers');
        await sendStatusUpdateNotificationHandler({
          leadId,
          statusLabel: data.statusLabel,
          loggedByName: data.loggedByName,
          tenantId,
          loggedByUid: data.loggedByUid,
          teamMemberUids: leadData.assignedPROUids || [],
        }, { auth: { token: { uid: data.loggedByUid, tenantId, role: data.loggedByUid } } });
      }
    } catch (e) {
      console.error('Failed to send status update notification:', e);
    }
  });

// ─── onTeamUpdated ────────────────────────────────────────────────────
export const onTeamUpdated = functions.firestore
  .document('teams/{teamId}')
  .onUpdate(async (change, context) => {
    const eventId = `teamUpdate_${context.params.teamId}_${change.after.updateTime?.seconds || Date.now()}`;
    if (await isAlreadyProcessed(db, eventId)) return;

    const before = change.before.data();
    const after = change.after.data();
    const teamId = context.params.teamId;
    const tenantId = after.tenantId;

    const membersChanged = JSON.stringify(before.memberUids) !== JSON.stringify(after.memberUids);
    const divisionsChanged = JSON.stringify(before.divisionIds) !== JSON.stringify(after.divisionIds);

    if (!membersChanged && !divisionsChanged) return;

    // Update leadAssignments for all affected divisions
    const affectedDivIds = [...new Set([...(before.divisionIds || []), ...(after.divisionIds || [])])];
    for (const divId of affectedDivIds) {
      const isInNew = (after.divisionIds || []).includes(divId);
      const snap = await db.collection('leadAssignments')
        .where('tenantId', '==', tenantId)
        .where('divisionId', '==', divId)
        .where('active', '==', true)
        .get();

      const now = admin.firestore.FieldValue.serverTimestamp();
      for (const doc of snap.docs) {
        if (isInNew) {
          await doc.ref.update({
            teamId,
            assignedPROUids: after.memberUids || [],
            updatedAt: now,
          });
        } else {
          await doc.ref.update({
            teamId: admin.firestore.FieldValue.delete(),
            assignedPROUids: [],
            updatedAt: now,
          });
        }
      }
    }

    // Also update leads directly
    for (const divId of affectedDivIds) {
      const isInNew = (after.divisionIds || []).includes(divId);
      const leadSnap = await db.collection('leads')
        .where('tenantId', '==', tenantId)
        .where('divisionId', '==', divId)
        .where('active', '==', true)
        .get();

      const now = admin.firestore.FieldValue.serverTimestamp();
      for (const doc of leadSnap.docs) {
        if (isInNew) {
          await doc.ref.update({ teamId, assignedPROUids: after.memberUids || [], updatedAt: now });
        } else {
          await doc.ref.update({ teamId: null, assignedPROUids: [], updatedAt: now });
        }
      }
    }
  });

// ─── onTeamDeleted ────────────────────────────────────────────────────
export const onTeamDeleted = functions.firestore
  .document('teams/{teamId}')
  .onDelete(async (snap, context) => {
    const teamData = snap.data();
    const tenantId = teamData.tenantId;
    const teamId = context.params.teamId;

    // Clear team assignments
    const assignmentSnap = await db.collection('leadAssignments')
      .where('tenantId', '==', tenantId)
      .where('teamId', '==', teamId)
      .get();

    const now = admin.firestore.FieldValue.serverTimestamp();
    for (const doc of assignmentSnap.docs) {
      await doc.ref.update({ teamId: null, assignedPROUids: [], updatedAt: now });
    }
  });

// ─── onReminderCreated ────────────────────────────────────────────────
export const onReminderCreated = functions.firestore
  .document('reminders/{reminderId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const tenantId = data.tenantId;
    const leadId = data.leadId;

    // Denorm nextFollowupAt to lead + assignment
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('leads').doc(leadId).update({
      nextFollowupAt: data.dueAt,
      nextFollowupReminderId: context.params.reminderId,
      updatedAt: now,
    });

    const assignmentId = `${tenantId}__${leadId}`;
    await db.collection('leadAssignments').doc(assignmentId).update({
      nextFollowupAt: data.dueAt,
      updatedAt: now,
    });

    // Increment followupsDueToday if due today
    const dueDate = data.dueAt?.toDate?.();
    if (dueDate) {
      const today = new Date();
      if (dueDate.toDateString() === today.toDateString()) {
        await db.collection('tenant_stats').doc(tenantId).set({
          followupsDueToday: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        }, { merge: true });
      }
    }
  });

// ─── onReminderStatusChanged ──────────────────────────────────────────
export const onReminderStatusChanged = functions.firestore
  .document('reminders/{reminderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tenantId = after.tenantId;
    const leadId = after.leadId;

    if (before.status === after.status) return;

    // If completed/cancelled, recompute lead's nextFollowupAt
    if (['COMPLETED', 'CANCELLED', 'SNOOZED'].includes(after.status)) {
      // Find next PENDING reminder for this lead
      const nextReminderSnap = await db.collection('reminders')
        .where('leadId', '==', leadId)
        .where('status', '==', 'PENDING')
        .orderBy('dueAt', 'asc')
        .limit(1)
        .get();

      const now = admin.firestore.FieldValue.serverTimestamp();
      if (nextReminderSnap.empty) {
        await db.collection('leads').doc(leadId).update({
          nextFollowupAt: admin.firestore.FieldValue.delete(),
          nextFollowupReminderId: admin.firestore.FieldValue.delete(),
          updatedAt: now,
        });
        const assignmentId = `${tenantId}__${leadId}`;
        await db.collection('leadAssignments').doc(assignmentId).update({
          nextFollowupAt: admin.firestore.FieldValue.delete(),
          updatedAt: now,
        });
      } else {
        const nextReminder = nextReminderSnap.docs[0];
        await db.collection('leads').doc(leadId).update({
          nextFollowupAt: nextReminder.data().dueAt,
          nextFollowupReminderId: nextReminder.id,
          updatedAt: now,
        });
        const assignmentId = `${tenantId}__${leadId}`;
        await db.collection('leadAssignments').doc(assignmentId).update({
          nextFollowupAt: nextReminder.data().dueAt,
          updatedAt: now,
        });
      }

      // Decrement followupsDueToday if was due today
      const dueDate = before.dueAt?.toDate?.();
      if (dueDate) {
        const today = new Date();
        if (dueDate.toDateString() === today.toDateString()) {
          await db.collection('tenant_stats').doc(tenantId).set({
            followupsDueToday: admin.firestore.FieldValue.increment(-1),
            updatedAt: now,
          }, { merge: true });
        }
      }
    }
  });

// ─── onUserUpdated ────────────────────────────────────────────────────
export const onUserUpdated = functions.firestore
  .document('users/{uid}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const uid = context.params.uid;

    // If role or teamId changed, re-set custom claims
    if (before.role !== after.role || before.teamId !== after.teamId) {
      const customClaims: Record<string, any> = {
        role: after.role,
        tenantId: after.tenantId,
      };
      if (after.teamId) customClaims.teamId = after.teamId;
      await admin.auth().setCustomUserClaims(uid, customClaims);
    }
  });
