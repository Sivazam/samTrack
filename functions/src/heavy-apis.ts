import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
  verifyAuthToken,
  requireSuperAdmin,
  requireAdminOrManager,
  requirePROOrAbove,
  isAdminOrManager,
  cleanPhoneStr,
  checkRateLimit,
  isAlreadyProcessed,
  commitInChunks,
  validateUsername,
  validateUniqueLeadId,
  buildLeadAssignmentSearchFields,
} from './utils';

const db = admin.firestore();
const auth = admin.auth();

// Helper to get division doc
async function getDivision(divisionId: string): Promise<admin.firestore.DocumentSnapshot> {
  return db.collection('divisions').doc(divisionId).get();
}

// Helper to find team for a division
async function findTeamForDivision(tenantId: string, divisionId: string): Promise<admin.firestore.QueryDocumentSnapshot | null> {
  const snap = await db.collection('teams')
    .where('tenantId', '==', tenantId)
    .where('divisionIds', 'array-contains', divisionId)
    .where('active', '==', true)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

// Helper to get all admin/manager UIDs for a tenant
async function getTenantAdminManagerUids(tenantId: string): Promise<string[]> {
  const snap = await db.collection('users')
    .where('tenantId', '==', tenantId)
    .where('active', '==', true)
    .get();
  return snap.docs
    .filter(d => {
      const r = d.data().role;
      return r === 'COLLEGE_ADMIN' || r === 'MANAGER';
    })
    .map(d => d.id);
}

// ═══════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

export async function createUserHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);

  // SUPER_ADMIN can specify a target tenantId to create users in any college
  // Other roles are scoped to their own tenantId
  let tenantId: string;
  if (token.role === 'SUPER_ADMIN' && payload.tenantId) {
    tenantId = payload.tenantId as string;
    // Verify the tenant exists
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target tenant not found');
    }
  } else {
    tenantId = token.tenantId as string;
  }

  if (!tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId required');
  }

  const { email, username, password, displayName, role, teamId, assignedDivisionIds, phone } = payload;

  // Validate
  if (!email || !username || !password || !displayName || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }
  const usernameError = validateUsername(username);
  if (usernameError) throw new functions.https.HttpsError('invalid-argument', usernameError);
  if (!['COLLEGE_ADMIN', 'MANAGER', 'PRO'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role');
  }
  if (password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
  }

  const usernameLower = username.toLowerCase();
  const indexDocId = `${tenantId}__${usernameLower}`;

  // Run in transaction
  return db.runTransaction(async (tx) => {
    // Check username uniqueness
    const indexRef = db.collection('usernameIndex').doc(indexDocId);
    const indexDoc = await tx.get(indexRef);
    if (indexDoc.exists) {
      // Check if the entry is stale (the referenced user doc no longer exists)
      const existingUid = indexDoc.data()?.uid as string | undefined;
      if (existingUid) {
        const existingUserDoc = await tx.get(db.collection('users').doc(existingUid));
        if (existingUserDoc.exists) {
          throw new functions.https.HttpsError('already-exists', 'Username already taken');
        }
        // Stale index entry — fall through and allow creation (will overwrite the index doc)
      } else {
        throw new functions.https.HttpsError('already-exists', 'Username already taken');
      }
    }

    // Create Auth user
    let uid: string;
    try {
      const userRecord = await auth.createUser({ email, password, displayName });
      uid = userRecord.uid;
    } catch (e: any) {
      throw new functions.https.HttpsError('internal', `Failed to create auth user: ${e.message}`);
    }

    try {
      // Set custom claims
      const customClaims: Record<string, any> = { role, tenantId };
      if (teamId) customClaims.teamId = teamId;
      await auth.setCustomUserClaims(uid, customClaims);

      // Write user doc
      const userRef = db.collection('users').doc(uid);
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(userRef, {
        tenantId,
        email,
        username: usernameLower,
        displayName,
        phone: phone || null,
        role,
        teamId: teamId || null,
        assignedDivisionIds: assignedDivisionIds || [],
        active: true,
        fcmDevices: [],
        createdAt: now,
        updatedAt: now,
        createdByUid: token.uid,
      });

      // Write username index
      tx.set(indexRef, {
        uid,
        email,
        tenantId,
        username: usernameLower,
        createdAt: now,
      });

      return { success: true, uid };
    } catch (e: any) {
      // Roll back Auth user
      try { await auth.deleteUser(uid); } catch (_) {}
      throw new functions.https.HttpsError('internal', `Failed to create user: ${e.message}`);
    }
  });
}

export async function updateUserHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);

  const { userId, displayName, phone, role, teamId, assignedDivisionIds, active, username } = payload;
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'userId required');

  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

  const userData = userDoc.data()!;

  const result = await db.runTransaction(async (tx) => {
    const updates: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (displayName !== undefined) updates.displayName = displayName;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (teamId !== undefined) updates.teamId = teamId;
    if (assignedDivisionIds !== undefined) updates.assignedDivisionIds = assignedDivisionIds;
    if (active !== undefined) updates.active = active;

    // Handle username change
    if (username !== undefined && username !== userData.username) {
      const usernameError = validateUsername(username);
      if (usernameError) throw new functions.https.HttpsError('invalid-argument', usernameError);

      const newIndexId = `${userData.tenantId}__${username.toLowerCase()}`;
      const newIndexRef = db.collection('usernameIndex').doc(newIndexId);
      const newIndexDoc = await tx.get(newIndexRef);
      if (newIndexDoc.exists) throw new functions.https.HttpsError('already-exists', 'Username already taken');

      // Delete old index + create new
      const oldIndexId = `${userData.tenantId}__${userData.username}`;
      tx.delete(db.collection('usernameIndex').doc(oldIndexId));
      tx.set(newIndexRef, {
        uid: userId,
        email: userData.email,
        tenantId: userData.tenantId,
        username: username.toLowerCase(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      updates.username = username.toLowerCase();
    }

    tx.update(userRef, updates);

    // Update custom claims if role or teamId changed
    if (role !== undefined || teamId !== undefined) {
      const newRole = role || userData.role;
      const newTeamId = teamId !== undefined ? teamId : userData.teamId;
      const customClaims: Record<string, any> = { role: newRole, tenantId: userData.tenantId };
      if (newTeamId) customClaims.teamId = newTeamId;
      await auth.setCustomUserClaims(userId, customClaims);
    }

    // If deactivating, revoke tokens
    if (active === false) {
      await auth.revokeRefreshTokens(userId);
    }

    return { success: true };
  });

  // Cascade: remove user's UID from leadAssignments and leads when they leave
  // a team (teamId set to null/different) or are deactivated. updateUserHandler
  // and manageTeam are separate flows — manageTeam handles the team-level cascade
  // but direct user updates bypass it entirely, leaving stale assignedPROUids.
  const isLeavingTeam = teamId === null || (teamId !== undefined && teamId !== userData.teamId);
  const isDeactivating = active === false;
  if ((isLeavingTeam || isDeactivating) && userData.tenantId) {
    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    // Remove from leadAssignments
    const assignmentSnap = await db.collection('leadAssignments')
      .where('tenantId', '==', userData.tenantId)
      .where('assignedPROUids', 'array-contains', userId)
      .where('active', '==', true)
      .get();
    if (!assignmentSnap.empty) {
      const ops = assignmentSnap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
        batch.update(d.ref, {
          assignedPROUids: admin.firestore.FieldValue.arrayRemove(userId),
          updatedAt: nowTs,
        });
      });
      await commitInChunks(db, ops);
    }

    // Remove from leads
    const leadSnap = await db.collection('leads')
      .where('tenantId', '==', userData.tenantId)
      .where('assignedPROUids', 'array-contains', userId)
      .where('active', '==', true)
      .get();
    if (!leadSnap.empty) {
      const leadOps = leadSnap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
        batch.update(d.ref, {
          assignedPROUids: admin.firestore.FieldValue.arrayRemove(userId),
          updatedAt: nowTs,
        });
      });
      await commitInChunks(db, leadOps);
    }

    // Remove user from old team's memberUids so the team stays consistent
    if (isLeavingTeam && userData.teamId) {
      await db.collection('teams').doc(userData.teamId).update({
        memberUids: admin.firestore.FieldValue.arrayRemove(userId),
        updatedAt: nowTs,
      });
    }
  }

  return result;
}

export async function deactivateUserHandler(payload: any, request: CallableRequest) {
  return updateUserHandler({ userId: payload.userId, active: false }, request);
}

// ═══════════════════════════════════════════════════════════════════════
// TEAM MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

export async function manageTeamHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  const { subAction, teamId, name, memberUids, divisionIds } = payload;

  if (subAction === 'create') {
    if (!name || !memberUids || memberUids.length < 1) {
      throw new functions.https.HttpsError('invalid-argument', 'Name and at least 1 member required');
    }
    if (memberUids.length > 5) {
      throw new functions.https.HttpsError('invalid-argument', 'Team can have at most 5 members');
    }
    // Ensure no PRO is already in another active team
    for (const uid of memberUids) {
      const existingSnap = await db.collection('teams')
        .where('tenantId', '==', tenantId)
        .where('memberUids', 'array-contains', uid)
        .where('active', '==', true)
        .limit(1)
        .get();
      if (!existingSnap.empty) {
        const userDoc = await db.collection('users').doc(uid).get();
        const uname = userDoc.exists ? userDoc.data()!.displayName : uid;
        throw new functions.https.HttpsError('invalid-argument', `${uname} is already a member of another active team`);
      }
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const teamRef = db.collection('teams').doc();
    await teamRef.set({
      tenantId,
      name,
      memberUids,
      divisionIds: divisionIds || [],
      active: true,
      createdAt: now,
      updatedAt: now,
      createdByUid: token.uid,
    });

    // Update leadAssignments for divisions
    if (divisionIds && divisionIds.length > 0) {
      await updateAssignmentsForTeams(tenantId, teamRef.id, memberUids, divisionIds);
    }

    // Update PRO user docs with teamId and assignedDivisionIds
    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    for (const uid of memberUids) {
      await db.collection('users').doc(uid).update({
        teamId: teamRef.id,
        assignedDivisionIds: divisionIds || [],
        updatedAt: nowTs,
      });
    }

    return { success: true, teamId: teamRef.id };
  }

  if (subAction === 'update') {
    if (!teamId) throw new functions.https.HttpsError('invalid-argument', 'teamId required');
    const teamRef = db.collection('teams').doc(teamId);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) throw new functions.https.HttpsError('not-found', 'Team not found');

    const updates: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name !== undefined) updates.name = name;
    if (memberUids !== undefined) {
      if (memberUids.length < 1 || memberUids.length > 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Team must have 1-5 members');
      }
      // Ensure no new member is already in a different active team
      const oldMemberSet = new Set<string>(teamDoc.data()!.memberUids || []);
      for (const uid of memberUids) {
        if (!oldMemberSet.has(uid)) {
          const existingSnap = await db.collection('teams')
            .where('tenantId', '==', tenantId)
            .where('memberUids', 'array-contains', uid)
            .where('active', '==', true)
            .limit(1)
            .get();
          if (!existingSnap.empty) {
            const userDoc = await db.collection('users').doc(uid).get();
            const uname = userDoc.exists ? userDoc.data()!.displayName : uid;
            throw new functions.https.HttpsError('invalid-argument', `${uname} is already a member of another active team`);
          }
        }
      }
      updates.memberUids = memberUids;
    }
    if (divisionIds !== undefined) updates.divisionIds = divisionIds;

    await teamRef.update(updates);

    // Update leadAssignments
    const finalMemberUids = memberUids || teamDoc.data()!.memberUids;
    const finalDivisionIds = divisionIds || teamDoc.data()!.divisionIds;
    await updateAssignmentsForTeams(tenantId, teamId, finalMemberUids, finalDivisionIds);

    // Update PRO user docs with teamId and assignedDivisionIds
    // First, clear old members who are no longer in the team
    const oldMemberUids: string[] = teamDoc.data()!.memberUids || [];
    const removedUids = oldMemberUids.filter((uid: string) => !finalMemberUids.includes(uid));
    const updateTs = admin.firestore.FieldValue.serverTimestamp();

    for (const uid of removedUids) {
      await db.collection('users').doc(uid).update({
        teamId: null,
        assignedDivisionIds: [],
        updatedAt: updateTs,
      });
    }

    // Then, update current members with new teamId and assignedDivisionIds
    for (const uid of finalMemberUids) {
      await db.collection('users').doc(uid).update({
        teamId,
        assignedDivisionIds: finalDivisionIds,
        updatedAt: updateTs,
      });
    }

    return { success: true };
  }

  if (subAction === 'dissolve') {
    if (!teamId) throw new functions.https.HttpsError('invalid-argument', 'teamId required');
    await db.collection('teams').doc(teamId).update({
      active: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Clear teamId/assignedPROUids on related leadAssignments
    const snap = await db.collection('leadAssignments')
      .where('tenantId', '==', tenantId)
      .where('teamId', '==', teamId)
      .where('active', '==', true)
      .get();
    const ops = snap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
      batch.update(d.ref, { teamId: admin.firestore.FieldValue.delete(), assignedPROUids: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await commitInChunks(db, ops);

    // Also clear teamId/assignedPROUids on the leads collection itself
    const leadSnap = await db.collection('leads')
      .where('tenantId', '==', tenantId)
      .where('teamId', '==', teamId)
      .where('active', '==', true)
      .get();
    const leadOps = leadSnap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
      batch.update(d.ref, { teamId: null, assignedPROUids: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await commitInChunks(db, leadOps);

    // Clear teamId/assignedDivisionIds on PRO user docs
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (teamDoc.exists) {
      const memberUids: string[] = teamDoc.data()!.memberUids || [];
      const dissolveTs = admin.firestore.FieldValue.serverTimestamp();
      for (const uid of memberUids) {
        await db.collection('users').doc(uid).update({
          teamId: null,
          assignedDivisionIds: [],
          updatedAt: dissolveTs,
        });
      }
    }

    return { success: true, clearedAssignments: snap.size };
  }

  throw new functions.https.HttpsError('invalid-argument', `Unknown subAction: ${subAction}`);
}

async function updateAssignmentsForTeams(tenantId: string, teamId: string, memberUids: string[], divisionIds: string[]): Promise<void> {
  for (const divId of divisionIds) {
    const snap = await db.collection('leadAssignments')
      .where('tenantId', '==', tenantId)
      .where('divisionId', '==', divId)
      .where('active', '==', true)
      .get();

    const ops = snap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
      batch.update(d.ref, {
        teamId,
        assignedPROUids: memberUids,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await commitInChunks(db, ops);

    // Also update leads collection
    const leadSnap = await db.collection('leads')
      .where('tenantId', '==', tenantId)
      .where('divisionId', '==', divId)
      .where('active', '==', true)
      .get();

    const leadOps = leadSnap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
      batch.update(d.ref, {
        teamId,
        assignedPROUids: memberUids,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await commitInChunks(db, leadOps);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LEAD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

export async function createLeadHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  const { uniqueLeadId: rawId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionId } = payload;
  const uniqueLeadId = Number(rawId);

  if (!rawId || !parentName || !studentName || !divisionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: uniqueLeadId, parentName, studentName, divisionId');
  }

  const idError = validateUniqueLeadId(uniqueLeadId);
  if (idError) throw new functions.https.HttpsError('invalid-argument', idError);

  // Check uniqueness
  const existing = await db.collection('leads')
    .where('tenantId', '==', tenantId)
    .where('uniqueLeadId', '==', uniqueLeadId)
    .limit(1)
    .get();
  if (!existing.empty) {
    throw new functions.https.HttpsError('already-exists', `Lead ID ${uniqueLeadId} already exists`);
  }

  // Get division name
  const divisionDoc = await getDivision(divisionId);
  if (!divisionDoc.exists) throw new functions.https.HttpsError('not-found', 'Division not found');
  const divisionData = divisionDoc.data()!;
  const divisionName = divisionData.name;

  // Find team for division
  let teamId: string | null = null;
  let assignedPROUids: string[] = [];
  const teamDoc = await findTeamForDivision(tenantId, divisionId);
  if (teamDoc) {
    teamId = teamDoc.id;
    assignedPROUids = teamDoc.data().memberUids || [];
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const leadRef = db.collection('leads').doc();
  const leadId = leadRef.id;
  const cleanedParentPhone = cleanPhoneStr(parentPhone);
  const cleanedStudentPhone = cleanPhoneStr(studentPhone);

  const leadData: Record<string, any> = {
    tenantId,
    uniqueLeadId,
    parentName: parentName.trim(),
    parentName_lowercase: parentName.trim().toLowerCase(),
    studentName: studentName.trim(),
    studentName_lowercase: studentName.trim().toLowerCase(),
    parentPhone: cleanedParentPhone || null,
    studentPhone: cleanedStudentPhone || null,
    intermediateGroup: intermediateGroup || null,
    address: address || null,
    divisionId,
    divisionName,
    teamId,
    assignedPROUids,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdByUid: token.uid,
  };

  // Build assignment search fields
  const searchFields = buildLeadAssignmentSearchFields(leadData, divisionData);

  // Write lead + assignment in batch
  const batch = db.batch();
  batch.set(leadRef, leadData);

  const assignmentId = `${tenantId}__${leadId}`;
  batch.set(db.collection('leadAssignments').doc(assignmentId), {
    tenantId,
    leadId,
    teamId,
    assignedPROUids,
    ...searchFields,
    lastStatusCode: null,
    nextFollowupAt: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
  return { success: true, leadId };
}

export async function createReferralLeadHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requirePROOrAbove(token);
  const tenantId = token.tenantId as string;

  const { uniqueLeadId: rawId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionId } = payload;
  const uniqueLeadId = Number(rawId);

  if (!rawId || !parentName || !studentName || !divisionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: uniqueLeadId, parentName, studentName, divisionId');
  }

  const idError = validateUniqueLeadId(uniqueLeadId);
  if (idError) throw new functions.https.HttpsError('invalid-argument', idError);

  // PROs can only create leads in their assigned divisions
  if (token.role === 'PRO') {
    const userDoc = await db.collection('users').doc(token.uid).get();
    if (userDoc.exists) {
      const assignedDivisionIds: string[] = userDoc.data()!.assignedDivisionIds || [];
      if (assignedDivisionIds.length > 0 && !assignedDivisionIds.includes(divisionId)) {
        throw new functions.https.HttpsError('permission-denied', 'Division not assigned to your team');
      }
    }
  }

  // Check Lead ID uniqueness
  const existing = await db.collection('leads')
    .where('tenantId', '==', tenantId)
    .where('uniqueLeadId', '==', uniqueLeadId)
    .limit(1)
    .get();
  if (!existing.empty) {
    throw new functions.https.HttpsError('already-exists', `Lead ID ${uniqueLeadId} already exists`);
  }

  // Get division
  const divisionDoc = await getDivision(divisionId);
  if (!divisionDoc.exists) throw new functions.https.HttpsError('not-found', 'Division not found');
  const divisionData = divisionDoc.data()!;
  const divisionName = divisionData.name;

  // Find team for division
  let teamId: string | null = null;
  let assignedPROUids: string[] = [];
  const teamDoc = await findTeamForDivision(tenantId, divisionId);
  if (teamDoc) {
    teamId = teamDoc.id;
    assignedPROUids = teamDoc.data().memberUids || [];
  } else {
    // PRO creating referral in an unassigned division — still assign themselves
    assignedPROUids = [token.uid];
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const leadRef = db.collection('leads').doc();
  const leadId = leadRef.id;
  const cleanedParentPhone = cleanPhoneStr(parentPhone);
  const cleanedStudentPhone = cleanPhoneStr(studentPhone);

  const leadData: Record<string, any> = {
    tenantId,
    uniqueLeadId,
    parentName: parentName.trim(),
    parentName_lowercase: parentName.trim().toLowerCase(),
    studentName: studentName.trim(),
    studentName_lowercase: studentName.trim().toLowerCase(),
    parentPhone: cleanedParentPhone || null,
    studentPhone: cleanedStudentPhone || null,
    intermediateGroup: intermediateGroup || null,
    address: address || null,
    divisionId,
    divisionName,
    teamId,
    assignedPROUids,
    isReferral: true,
    active: true,
    createdAt: now,
    updatedAt: now,
    createdByUid: token.uid,
  };

  const searchFields = buildLeadAssignmentSearchFields(leadData, divisionData);

  const batch = db.batch();
  batch.set(leadRef, leadData);

  const assignmentId = `${tenantId}__${leadId}`;
  batch.set(db.collection('leadAssignments').doc(assignmentId), {
    tenantId,
    leadId,
    teamId,
    assignedPROUids,
    ...searchFields,
    isReferral: true,
    lastStatusCode: null,
    nextFollowupAt: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
  return { success: true, leadId };
}

export async function bulkCreateLeadsHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  // Rate limit: 1 import per minute
  await checkRateLimit(db, `bulkImport_${tenantId}`, 1);

  const { rows, sourceFilename, cityFromFilename, mode = 'skip' } = payload;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'rows array required');
  }

  const batchId = db.collection('importBatches').doc().id;
  let successRows = 0;
  let errorRows = 0;
  const errors: Array<{ row: number; uniqueLeadId?: number; reason: string }> = [];

  // Process in chunks of 400
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const writeBatch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const rowNum = i + j + 1;

      try {
        const { uniqueLeadId: rawRowId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionName, divisionId: rowDivId } = row;
        const uniqueLeadId = Number(rawRowId);

        if (!rawRowId || !parentName || !studentName) {
          errors.push({ row: rowNum, uniqueLeadId: uniqueLeadId || undefined, reason: 'Missing required fields' });
          errorRows++;
          continue;
        }
        const rowIdErr = validateUniqueLeadId(uniqueLeadId);
        if (rowIdErr) {
          errors.push({ row: rowNum, uniqueLeadId: uniqueLeadId || undefined, reason: rowIdErr });
          errorRows++;
          continue;
        }

        // Check uniqueness (for first batch, query; for subsequent, check local set)
        const existing = await db.collection('leads')
          .where('tenantId', '==', tenantId)
          .where('uniqueLeadId', '==', uniqueLeadId)
          .limit(1)
          .get();

        if (!existing.empty) {
          if (mode === 'skip') {
            successRows++; // Count as success (skipped)
            continue;
          } else {
            errors.push({ row: rowNum, uniqueLeadId, reason: 'Duplicate lead ID' });
            errorRows++;
            continue;
          }
        }

        // Resolve division
        let divId = rowDivId;
        let divName = divisionName || '';
        if (!divId && divisionName) {
          const divSnap = await db.collection('divisions')
            .where('tenantId', '==', tenantId)
            .where('name', '==', divisionName)
            .limit(1)
            .get();
          if (!divSnap.empty) {
            divId = divSnap.docs[0].id;
            divName = divSnap.docs[0].data().name;
          }
        }

        // Find team
        let teamId: string | null = null;
        let assignedPROUids: string[] = [];
        if (divId) {
          const teamDoc = await findTeamForDivision(tenantId, divId);
          if (teamDoc) {
            teamId = teamDoc.id;
            assignedPROUids = teamDoc.data().memberUids || [];
          }
        }

        const leadRef = db.collection('leads').doc();
        const leadId = leadRef.id;
        const leadData: Record<string, any> = {
          tenantId,
          uniqueLeadId,
          parentName: parentName.trim(),
          parentName_lowercase: parentName.trim().toLowerCase(),
          studentName: studentName.trim(),
          studentName_lowercase: studentName.trim().toLowerCase(),
          parentPhone: cleanPhoneStr(parentPhone) || null,
          studentPhone: cleanPhoneStr(studentPhone) || null,
          intermediateGroup: intermediateGroup || null,
          address: address || null,
          divisionId: divId || '',
          divisionName: divName,
          sourceCity: cityFromFilename || null,
          sourceImportBatchId: batchId,
          teamId,
          assignedPROUids,
          active: true,
          createdAt: now,
          updatedAt: now,
          createdByUid: token.uid,
        };

        const searchFields = buildLeadAssignmentSearchFields(leadData);

        writeBatch.set(leadRef, leadData);
        writeBatch.set(db.collection('leadAssignments').doc(`${tenantId}__${leadId}`), {
          tenantId, leadId, teamId, assignedPROUids, ...searchFields,
          lastStatusCode: null, nextFollowupAt: null, active: true, createdAt: now, updatedAt: now,
        });

        successRows++;
      } catch (e: any) {
        errors.push({ row: rowNum, uniqueLeadId: Number(row.uniqueLeadId) || undefined, reason: e.message || 'Unknown error' });
        errorRows++;
      }
    }

    await writeBatch.commit();
  }

  // Write import batch record
  await db.collection('importBatches').doc(batchId).set({
    tenantId,
    sourceFilename: sourceFilename || 'unknown',
    uploadedByUid: token.uid,
    totalRows: rows.length,
    successRows,
    errorRows,
    errors: errors.slice(0, 100), // Cap errors
    cityFromFilename: cityFromFilename || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, batchId, successCount: successRows, errorCount: errorRows, errors: errors.slice(0, 50) };
}

export async function updateLeadHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  const tenantId = token.tenantId as string;

  const { leadId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionId, active } = payload;
  if (!leadId) throw new functions.https.HttpsError('invalid-argument', 'leadId required');

  const leadRef = db.collection('leads').doc(leadId);
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) throw new functions.https.HttpsError('not-found', 'Lead not found');

  const leadDocData = leadDoc.data()!;
  const isAdmin = isAdminOrManager(token.role);
  const isPRO = token.role === 'PRO';

  // PROs can only edit leads assigned to them; they cannot change the area/division
  if (!isAdmin) {
    if (!isPRO) throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    if (!leadDocData.assignedPROUids?.includes(token.uid)) {
      throw new functions.https.HttpsError('permission-denied', 'Not assigned to this lead');
    }
    if (divisionId && divisionId !== leadDocData.divisionId) {
      throw new functions.https.HttpsError('permission-denied', 'PROs cannot change the area assignment');
    }
  }

  const updates: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (parentName !== undefined) { updates.parentName = parentName.trim(); updates.parentName_lowercase = parentName.trim().toLowerCase(); }
  if (studentName !== undefined) { updates.studentName = studentName.trim(); updates.studentName_lowercase = studentName.trim().toLowerCase(); }
  if (parentPhone !== undefined) updates.parentPhone = cleanPhoneStr(parentPhone) || null;
  if (studentPhone !== undefined) updates.studentPhone = cleanPhoneStr(studentPhone) || null;
  if (intermediateGroup !== undefined) updates.intermediateGroup = intermediateGroup;
  if (address !== undefined) updates.address = address;
  if (active !== undefined) updates.active = active;

  let divisionChanged = false;
  let newDivisionName = leadDocData.divisionName;
  let newDivisionId = divisionId || leadDocData.divisionId;
  let newTeamId = leadDocData.teamId;
  let newAssignedPROUids = leadDocData.assignedPROUids || [];

  if (divisionId && divisionId !== leadDocData.divisionId) {
    divisionChanged = true;
    const divDoc = await getDivision(divisionId);
    if (!divDoc.exists) throw new functions.https.HttpsError('not-found', 'Division not found');
    newDivisionName = divDoc.data()!.name;
    updates.divisionId = divisionId;
    updates.divisionName = newDivisionName;

    // Reassign to team for new division
    const teamDoc = await findTeamForDivision(leadDocData.tenantId, divisionId);
    if (teamDoc) {
      newTeamId = teamDoc.id;
      newAssignedPROUids = teamDoc.data().memberUids || [];
    } else {
      newTeamId = null;
      newAssignedPROUids = [];
    }
    updates.teamId = newTeamId;
    updates.assignedPROUids = newAssignedPROUids;
  }

  await leadRef.update(updates);

  // Sync to leadAssignments
  const assignmentId = `${leadDocData.tenantId}__${leadId}`;
  const assignmentRef = db.collection('leadAssignments').doc(assignmentId);
  const assignmentUpdates: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (parentName !== undefined) { assignmentUpdates.parentName = parentName.trim(); assignmentUpdates.parentName_lowercase = parentName.trim().toLowerCase(); }
  if (studentName !== undefined) { assignmentUpdates.studentName = studentName.trim(); assignmentUpdates.studentName_lowercase = studentName.trim().toLowerCase(); }
  if (parentPhone !== undefined) assignmentUpdates.parentPhone = cleanPhoneStr(parentPhone) || null;
  if (studentPhone !== undefined) assignmentUpdates.studentPhone = cleanPhoneStr(studentPhone) || null;
  if (divisionChanged) {
    assignmentUpdates.divisionId = newDivisionId;
    assignmentUpdates.divisionName = newDivisionName;
    assignmentUpdates.teamId = newTeamId;
    assignmentUpdates.assignedPROUids = newAssignedPROUids;
  }
  if (active !== undefined) assignmentUpdates.active = active;

  await assignmentRef.update(assignmentUpdates);

  return { success: true };
}

export async function reassignLeadTeamHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);

  const { leadId, toTeamId } = payload;
  if (!leadId || !toTeamId) throw new functions.https.HttpsError('invalid-argument', 'leadId and toTeamId required');

  const teamDoc = await db.collection('teams').doc(toTeamId).get();
  if (!teamDoc.exists) throw new functions.https.HttpsError('not-found', 'Team not found');
  const teamData = teamDoc.data()!;

  const leadRef = db.collection('leads').doc(leadId);
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) throw new functions.https.HttpsError('not-found', 'Lead not found');

  const now = admin.firestore.FieldValue.serverTimestamp();
  await leadRef.update({
    teamId: toTeamId,
    assignedPROUids: teamData.memberUids || [],
    updatedAt: now,
  });

  // Sync assignment
  const assignmentId = `${leadDoc.data()!.tenantId}__${leadId}`;
  await db.collection('leadAssignments').doc(assignmentId).update({
    teamId: toTeamId,
    assignedPROUids: teamData.memberUids || [],
    updatedAt: now,
  });

  return { success: true };
}

export async function bulkReassignLeadsHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  const { divisionId, fromTeamId, toTeamId, leadIds } = payload;
  if (!toTeamId) throw new functions.https.HttpsError('invalid-argument', 'toTeamId required');

  const teamDoc = await db.collection('teams').doc(toTeamId).get();
  if (!teamDoc.exists) throw new functions.https.HttpsError('not-found', 'Team not found');
  const memberUids = teamDoc.data()!.memberUids || [];

  // Build query
  let query = db.collection('leadAssignments')
    .where('tenantId', '==', tenantId)
    .where('active', '==', true);

  if (leadIds && leadIds.length > 0) {
    // Specific leads
    const ops: Array<(batch: admin.firestore.WriteBatch) => void> = [];
    for (const lid of leadIds) {
      ops.push((batch) => {
        batch.update(db.collection('leadAssignments').doc(`${tenantId}__${lid}`), {
          teamId: toTeamId, assignedPROUids: memberUids, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batch.update(db.collection('leads').doc(lid), {
          teamId: toTeamId, assignedPROUids: memberUids, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }
    await commitInChunks(db, ops);
    return { success: true, reassigned: leadIds.length };
  }

  if (divisionId) {
    query = query.where('divisionId', '==', divisionId);
  }
  if (fromTeamId) {
    query = query.where('teamId', '==', fromTeamId);
  }

  const snap = await query.get();
  const ops = snap.docs.map(d => (batch: admin.firestore.WriteBatch) => {
    const data = d.data();
    batch.update(d.ref, { teamId: toTeamId, assignedPROUids: memberUids, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    batch.update(db.collection('leads').doc(data.leadId), { teamId: toTeamId, assignedPROUids: memberUids, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  await commitInChunks(db, ops);

  return { success: true, reassigned: snap.size };
}

export async function syncLeadAssignmentsHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireSuperAdmin(token);
  const tenantId = payload.tenantId || token.tenantId;

  const leadsSnap = await db.collection('leads').where('tenantId', '==', tenantId).get();
  const ops: Array<(batch: admin.firestore.WriteBatch) => void> = [];

  for (const leadDoc of leadsSnap.docs) {
    const lead = leadDoc.data();
    const divDoc = lead.divisionId ? await getDivision(lead.divisionId) : null;
    const searchFields = buildLeadAssignmentSearchFields(lead, divDoc?.data());

    const assignmentId = `${tenantId}__${leadDoc.id}`;
    ops.push((batch) => {
      batch.set(db.collection('leadAssignments').doc(assignmentId), {
        tenantId,
        leadId: leadDoc.id,
        teamId: lead.teamId || null,
        assignedPROUids: lead.assignedPROUids || [],
        ...searchFields,
        lastStatusCode: lead.lastStatusCode || null,
        nextFollowupAt: lead.nextFollowupAt || null,
        active: lead.active !== false,
        createdAt: lead.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  const commits = await commitInChunks(db, ops);
  return { success: true, synced: leadsSnap.size, commits };
}

// ═══════════════════════════════════════════════════════════════════════
// STATUS UPDATES
// ═══════════════════════════════════════════════════════════════════════

export async function logStatusUpdateHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requirePROOrAbove(token);
  const tenantId = token.tenantId as string;

  const { leadId, approachType, statusCode, comments, parentPhone, studentPhone, intermediateGroup, joinedCollegeName, accompanyingMemberUid, gpsLocation, gpsRequired, gpsCaptured, nextFollowupAt, nextFollowupNote } = payload;

  if (!leadId || !approachType || !statusCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  // GPS validation
  if (gpsRequired && !gpsCaptured) {
    throw new functions.https.HttpsError('failed-precondition', 'GPS location required for this approach type');
  }

  const leadRef = db.collection('leads').doc(leadId);
  const leadDoc = await leadRef.get();
  if (!leadDoc.exists) throw new functions.https.HttpsError('not-found', 'Lead not found');
  const leadData = leadDoc.data()!;

  // Verify PRO is assigned to this lead
  if (!isAdminOrManager(token.role) && !leadData.assignedPROUids?.includes(token.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Not assigned to this lead');
  }

  // Get status label from tenantConfig
  let statusLabel = statusCode;
  try {
    const configDoc = await db.collection('tenantConfig').doc(tenantId).get();
    if (configDoc.exists) {
      const option = configDoc.data()!.statusOptions?.find((o: any) => o.code === statusCode);
      if (option) statusLabel = option.label;
    }
  } catch (_) {}

  // Get user info
  const userDoc = await db.collection('users').doc(token.uid).get();
  const userName = userDoc.exists ? userDoc.data()!.displayName : 'Unknown';
  let accompanyingName: string | undefined;
  if (accompanyingMemberUid) {
    const mateDoc = await db.collection('users').doc(accompanyingMemberUid).get();
    accompanyingName = mateDoc.exists ? mateDoc.data()!.displayName : undefined;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const updateRef = leadRef.collection('statusUpdates').doc();
  const statusUpdateData: Record<string, any> = {
    tenantId,
    leadId,
    approachType,
    statusCode,
    statusLabel,
    comments: comments || null,
    parentPhone: parentPhone || leadData.parentPhone || null,
    studentPhone: studentPhone || leadData.studentPhone || null,
    intermediateGroup: intermediateGroup || leadData.intermediateGroup || null,
    joinedCollegeName: joinedCollegeName || null,
    loggedByUid: token.uid,
    loggedByName: userName,
    accompanyingMemberUid: accompanyingMemberUid || null,
    accompanyingMemberName: accompanyingName || null,
    teamId: leadData.teamId || null,
    gpsLocation: gpsLocation || null,
    gpsRequired: gpsRequired || false,
    gpsCaptured: gpsCaptured || false,
    createdAt: now,
    createdByUid: token.uid,
  };

  // Build lead updates
  const leadUpdates: Record<string, any> = {
    lastStatusCode: statusCode,
    lastStatusLabel: statusLabel,
    lastStatusAt: now,
    lastApproachType: approachType,
    lastUpdatedByUid: token.uid,
    lastUpdatedByTeamId: leadData.teamId || null,
    updatedAt: now,
  };

  if (joinedCollegeName) leadUpdates.joinedCollegeName = joinedCollegeName;

  // Write status update + update lead in batch
  const batch = db.batch();
  batch.set(updateRef, statusUpdateData);
  batch.update(leadRef, leadUpdates);

  // Also update leadAssignment lastStatusCode
  const assignmentId = `${tenantId}__${leadId}`;
  batch.set(db.collection('leadAssignments').doc(assignmentId), {
    lastStatusCode: statusCode,
    lastStatusLabel: statusLabel,
    lastApproachType: approachType,
    updatedAt: now,
  }, { merge: true });

  await batch.commit();

  // Auto-complete previous PENDING reminder for this lead
  try {
    const reminderSnap = await db.collection('reminders')
      .where('leadId', '==', leadId)
      .where('status', '==', 'PENDING')
      .limit(1)
      .get();
    if (!reminderSnap.empty) {
      await reminderSnap.docs[0].ref.update({
        status: 'COMPLETED',
        completedAt: now,
        completedByUid: token.uid,
        updatedAt: now,
      });
    }
  } catch (_) {}

  // ─── If the PRO provided a next follow-up date, create a reminder ─────
  // This is the "follow-up reminder set via Log Update form" path the user expects.
  if (nextFollowupAt) {
    try {
      const dueDate = new Date(nextFollowupAt);
      if (!isNaN(dueDate.getTime())) {
        const adminManagerUids = await getTenantAdminManagerUids(tenantId);
        const teamMemberUids: string[] = leadData.assignedPROUids || [];
        const recipientUids = [...new Set([token.uid, ...teamMemberUids, ...adminManagerUids])];

        // Resolve team name & PRO names for richer admin display
        let teamName: string | null = null;
        if (leadData.teamId) {
          try {
            const teamDoc = await db.collection('teams').doc(leadData.teamId).get();
            if (teamDoc.exists) teamName = teamDoc.data()!.name || null;
          } catch (_) {}
        }
        let assignedPRONames: string[] = [];
        try {
          if (teamMemberUids.length > 0) {
            const proDocs = await Promise.all(teamMemberUids.map((u: string) => db.collection('users').doc(u).get()));
            assignedPRONames = proDocs.filter(d => d.exists).map(d => d.data()!.displayName || '');
          }
        } catch (_) {}

        const leadDisplayName = `${leadData.parentName} / ${leadData.studentName}`;
        const followupReminderRef = db.collection('reminders').doc();
        await followupReminderRef.set({
          tenantId,
          leadId,
          leadDisplayName,
          uniqueLeadId: leadData.uniqueLeadId,
          dueAt: admin.firestore.Timestamp.fromDate(dueDate),
          dueDateOnly: false,
          note: nextFollowupNote || `Follow up after ${statusLabel}`,
          createdByUid: token.uid,
          createdByName: userName,
          createdByRole: token.role || null,
          recipientUids,
          teamId: leadData.teamId || null,
          teamName,
          divisionId: leadData.divisionId || null,
          divisionName: leadData.divisionName || null,
          assignedPROUids: leadData.assignedPROUids || [],
          assignedPRONames,
          parentPhone: leadData.parentPhone || null,
          studentPhone: leadData.studentPhone || null,
          status: 'PENDING',
          source: 'LOG_UPDATE_FORM',
          createdAt: now,
          updatedAt: now,
        });

        // Denorm on the lead
        await leadRef.update({
          nextFollowupAt: admin.firestore.Timestamp.fromDate(dueDate),
          nextFollowupReminderId: followupReminderRef.id,
          updatedAt: now,
        });
      }
    } catch (e) {
      console.warn('Failed to create follow-up reminder from log update:', e);
    }
  }

  // Auto-create reminder if the status option has autoReminderDate
  try {
    const configDoc = await db.collection('tenantConfig').doc(tenantId).get();
    if (configDoc.exists) {
      const option = configDoc.data()!.statusOptions?.find((o: any) => o.code === statusCode);
      if (option?.autoReminderDate) {
        const baseDate = new Date(option.autoReminderDate);
        const offset = typeof option.autoReminderOffset === 'number' ? option.autoReminderOffset : 0;
        baseDate.setDate(baseDate.getDate() + offset);
        if (baseDate > new Date()) {
          const adminManagerUids = await getTenantAdminManagerUids(tenantId);
          const recipientUids = [...new Set([token.uid, ...adminManagerUids])];
          const leadDisplayName = `${leadData.parentName} / ${leadData.studentName}`;
          const autoReminderRef = db.collection('reminders').doc();
          await autoReminderRef.set({
            tenantId,
            leadId,
            leadDisplayName,
            uniqueLeadId: leadData.uniqueLeadId,
            dueAt: admin.firestore.Timestamp.fromDate(baseDate),
            dueDateOnly: true,
            note: `Auto: ${statusLabel} result day`,
            createdByUid: token.uid,
            createdByName: userName,
            recipientUids,
            status: 'PENDING',
            autoCreated: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  } catch (_) {}

  return { success: true, updateId: updateRef.id };
}

// ═══════════════════════════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════════════════════════

export async function manageReminderHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requirePROOrAbove(token);
  const tenantId = token.tenantId as string;

  const { subAction, reminderId, leadId, dueAt, dueDateOnly, note, snoozeDuration } = payload;

  if (subAction === 'create') {
    if (!leadId || !dueAt) throw new functions.https.HttpsError('invalid-argument', 'leadId and dueAt required');

    const leadDoc = await db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) throw new functions.https.HttpsError('not-found', 'Lead not found');
    const leadData = leadDoc.data()!;

    const userDoc = await db.collection('users').doc(token.uid).get();
    const userName = userDoc.exists ? userDoc.data()!.displayName : 'Unknown';

    // Compute recipient UIDs: creating PRO + team members + all admins/managers
    const adminManagerUids = await getTenantAdminManagerUids(tenantId);
    let teamMemberUids = leadData.assignedPROUids || [];
    const recipientUids = [...new Set([token.uid, ...teamMemberUids, ...adminManagerUids])];

    // Resolve team name for richer admin/manager display
    let teamName: string | null = null;
    if (leadData.teamId) {
      try {
        const teamDoc = await db.collection('teams').doc(leadData.teamId).get();
        if (teamDoc.exists) teamName = teamDoc.data()!.name || null;
      } catch (_) {}
    }
    // Resolve assigned PRO names
    let assignedPRONames: string[] = [];
    try {
      const proUidsList: string[] = leadData.assignedPROUids || [];
      if (proUidsList.length > 0) {
        const proDocs = await Promise.all(proUidsList.map((u: string) => db.collection('users').doc(u).get()));
        assignedPRONames = proDocs.filter(d => d.exists).map(d => d.data()!.displayName || '');
      }
    } catch (_) {}

    const leadDisplayName = `${leadData.parentName} / ${leadData.studentName}`;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const reminderRef = db.collection('reminders').doc();

    await reminderRef.set({
      tenantId,
      leadId,
      leadDisplayName,
      uniqueLeadId: leadData.uniqueLeadId,
      dueAt: admin.firestore.Timestamp.fromDate(new Date(dueAt)),
      dueDateOnly: dueDateOnly || false,
      note: note || null,
      createdByUid: token.uid,
      createdByName: userName,
      createdByRole: token.role || null,
      recipientUids,
      // ─── Rich metadata for admin/manager dashboards ───────────────
      teamId: leadData.teamId || null,
      teamName,
      divisionId: leadData.divisionId || null,
      divisionName: leadData.divisionName || null,
      assignedPROUids: leadData.assignedPROUids || [],
      assignedPRONames,
      parentPhone: leadData.parentPhone || null,
      studentPhone: leadData.studentPhone || null,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });

    // Denorm nextFollowupAt on lead + assignment
    await db.collection('leads').doc(leadId).update({
      nextFollowupAt: admin.firestore.Timestamp.fromDate(new Date(dueAt)),
      nextFollowupReminderId: reminderRef.id,
      updatedAt: now,
    });

    const assignmentId = `${tenantId}__${leadId}`;
    await db.collection('leadAssignments').doc(assignmentId).update({
      nextFollowupAt: admin.firestore.Timestamp.fromDate(new Date(dueAt)),
      updatedAt: now,
    });

    return { success: true, reminderId: reminderRef.id };
  }

  if (subAction === 'snooze') {
    if (!reminderId) throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
    const reminderDoc = await db.collection('reminders').doc(reminderId).get();
    if (!reminderDoc.exists) throw new functions.https.HttpsError('not-found', 'Reminder not found');
    const reminderData = reminderDoc.data()!;

    // Calculate snooze time
    let snoozeDate: Date;
    if (snoozeDuration === '1h') {
      snoozeDate = new Date(Date.now() + 60 * 60 * 1000);
    } else if (snoozeDuration === 'tomorrow') {
      snoozeDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      snoozeDate.setHours(10, 0, 0, 0);
    } else {
      snoozeDate = new Date(dueAt || Date.now() + 60 * 60 * 1000);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    // Mark old as SNOOZED
    await db.collection('reminders').doc(reminderId).update({
      status: 'SNOOZED',
      updatedAt: now,
    });

    // Create new reminder
    const newReminderRef = db.collection('reminders').doc();
    await newReminderRef.set({
      tenantId,
      leadId: reminderData.leadId,
      leadDisplayName: reminderData.leadDisplayName,
      uniqueLeadId: reminderData.uniqueLeadId,
      dueAt: admin.firestore.Timestamp.fromDate(snoozeDate),
      dueDateOnly: false,
      note: note || reminderData.note,
      createdByUid: token.uid,
      createdByName: reminderData.createdByName,
      recipientUids: reminderData.recipientUids,
      status: 'PENDING',
      snoozedFromReminderId: reminderId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, reminderId: newReminderRef.id };
  }

  if (subAction === 'complete') {
    if (!reminderId) throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('reminders').doc(reminderId).update({
      status: 'COMPLETED',
      completedAt: now,
      completedByUid: token.uid,
      updatedAt: now,
    });
    return { success: true };
  }

  if (subAction === 'cancel') {
    if (!reminderId) throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
    await db.collection('reminders').doc(reminderId).update({
      status: 'CANCELLED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  }

  if (subAction === 'update') {
    if (!reminderId) throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
    const updates: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (dueAt !== undefined) updates.dueAt = admin.firestore.Timestamp.fromDate(new Date(dueAt));
    if (dueDateOnly !== undefined) updates.dueDateOnly = dueDateOnly;
    if (note !== undefined) updates.note = note;
    await db.collection('reminders').doc(reminderId).update(updates);
    return { success: true };
  }

  throw new functions.https.HttpsError('invalid-argument', `Unknown subAction: ${subAction}`);
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════

export async function updateTenantConfigHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  const { statusOptions, intermediateGroups, joinedCollegeOptions } = payload;

  // Validate code uniqueness within each list
  if (statusOptions) {
    const codes = statusOptions.map((o: any) => o.code);
    if (new Set(codes).size !== codes.length) {
      throw new functions.https.HttpsError('invalid-argument', 'Duplicate status codes found');
    }
  }
  if (intermediateGroups) {
    const codes = intermediateGroups.map((o: any) => o.code);
    if (new Set(codes).size !== codes.length) {
      throw new functions.https.HttpsError('invalid-argument', 'Duplicate intermediate group codes found');
    }
  }
  if (joinedCollegeOptions) {
    const codes = joinedCollegeOptions.map((o: any) => o.code);
    if (new Set(codes).size !== codes.length) {
      throw new functions.https.HttpsError('invalid-argument', 'Duplicate joined college codes found');
    }
  }

  const updates: Record<string, any> = {
    tenantId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByUid: token.uid,
  };
  if (statusOptions) updates.statusOptions = statusOptions;
  if (intermediateGroups) updates.intermediateGroups = intermediateGroups;
  if (joinedCollegeOptions) updates.joinedCollegeOptions = joinedCollegeOptions;

  await db.collection('tenantConfig').doc(tenantId).set(updates, { merge: true });

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════
// REPORTS & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

export async function generateReportHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  const { type, startDate, endDate, divisionId, teamId, proUid } = payload;

  switch (type) {
    case 'daily_activity': {
      // Query statusUpdates for date range
      let query: admin.firestore.Query = db.collectionGroup('statusUpdates')
        .where('tenantId', '==', tenantId);
      if (startDate) query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)));
      if (endDate) query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)));
      query = query.orderBy('createdAt', 'desc').limit(5000);

      const snap = await query.get();
      const byPRO: Record<string, number> = {};
      const byTeam: Record<string, number> = {};
      const byApproach: Record<string, number> = { PHONE: 0, DOORSTEP: 0, WALK_IN: 0, ONLINE: 0 };

      snap.docs.forEach(d => {
        const data = d.data();
        byPRO[data.loggedByUid] = (byPRO[data.loggedByUid] || 0) + 1;
        if (data.teamId) byTeam[data.teamId] = (byTeam[data.teamId] || 0) + 1;
        if (data.approachType && byApproach[data.approachType] !== undefined) byApproach[data.approachType]++;
      });

      return { success: true, type, totalUpdates: snap.size, byPRO, byTeam, byApproach };
    }

    case 'status_funnel': {
      const statsDoc = await db.collection('tenant_stats').doc(tenantId).get();
      const stats = statsDoc.exists ? statsDoc.data() : {};
      return { success: true, type, stats };
    }

    case 'overdue_followups': {
      const now = admin.firestore.Timestamp.now();
      const reminderSnap = await db.collection('reminders')
        .where('tenantId', '==', tenantId)
        .where('status', 'in', ['PENDING', 'SENT'])
        .where('dueAt', '<=', now)
        .get();
      const overdue = reminderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, type, count: overdue.length, reminders: overdue };
    }

    case 'division_summary': {
      const divSnap = await db.collection('divisions')
        .where('tenantId', '==', tenantId)
        .where('active', '==', true)
        .get();
      const divisions = [];
      for (const divDoc of divSnap.docs) {
        const leadSnap = await db.collection('leads')
          .where('tenantId', '==', tenantId)
          .where('divisionId', '==', divDoc.id)
          .where('active', '==', true)
          .get();
        divisions.push({
          id: divDoc.id,
          name: divDoc.data().name,
          code: divDoc.data().code,
          leadCount: leadSnap.size,
        });
      }
      return { success: true, type, divisions };
    }

    default:
      throw new functions.https.HttpsError('invalid-argument', `Unknown report type: ${type}`);
  }
}

export async function getDashboardStatsHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  const tenantId = token.tenantId as string;
  if (!tenantId) throw new functions.https.HttpsError('permission-denied', 'No tenant');

  const statsDoc = await db.collection('tenant_stats').doc(tenantId).get();
  const stats = statsDoc.exists ? statsDoc.data() : {
    totalLeads: 0,
    totalActiveLeads: 0,
    byStatusCounts: {},
    followupsDueToday: 0,
    joinedSamhithaCount: 0,
    joinedOtherCount: 0,
  };

  return { success: true, stats };
}

// ═══════════════════════════════════════════════════════════════════════
// SUPER ADMIN
// ═══════════════════════════════════════════════════════════════════════

export async function adminCreateTenantHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireSuperAdmin(token);

  const { name, adminEmail, adminPassword, adminDisplayName, adminUsername, adminPhone } = payload;
  if (!name || !adminEmail || !adminPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'name, adminEmail, adminPassword required');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  // Create tenant doc
  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;

  await tenantRef.set({
    name,
    type: 'COLLEGE',
    status: 'ACTIVE',
    fcmDevices: [],
    createdAt: now,
    updatedAt: now,
  });

  // Create first admin user
  let uid: string;
  try {
    const userRecord = await auth.createUser({ email: adminEmail, password: adminPassword, displayName: adminDisplayName || adminEmail });
    uid = userRecord.uid;
  } catch (e: any) {
    // Roll back tenant
    await tenantRef.delete();
    throw new functions.https.HttpsError('internal', `Failed to create admin user: ${e.message}`);
  }

  try {
    const username = (adminUsername || 'admin').toLowerCase();
    await auth.setCustomUserClaims(uid, { role: 'COLLEGE_ADMIN', tenantId });

    await db.collection('users').doc(uid).set({
      tenantId,
      email: adminEmail,
      username,
      displayName: adminDisplayName || adminEmail,
      phone: adminPhone || null,
      role: 'COLLEGE_ADMIN',
      teamId: null,
      assignedDivisionIds: [],
      active: true,
      fcmDevices: [],
      createdAt: now,
      updatedAt: now,
      createdByUid: token.uid,
    });

    await db.collection('usernameIndex').doc(`${tenantId}__${username}`).set({
      uid, email: adminEmail, tenantId, username: username.toLowerCase(), createdAt: now,
    });

    // Create default tenantConfig for the new college
    const defaultStatusOptions = [
      { code: 'NEW', label: 'New', color: '#6366f1', isTerminal: false, order: 1, active: true },
      { code: 'CONTACTED', label: 'Contacted', color: '#8b5cf6', isTerminal: false, order: 2, active: true },
      { code: 'VISITED', label: 'Visited', color: '#a855f7', isTerminal: false, order: 3, active: true },
      { code: 'APPLIED', label: 'Applied', color: '#d946ef', isTerminal: false, order: 4, active: true },
      { code: 'ADMITTED', label: 'Admitted', color: '#10b981', isTerminal: false, order: 5, active: true },
      { code: 'ENROLLED', label: 'Enrolled', color: '#14b8a6', isTerminal: true, order: 6, active: true },
    ];
    const defaultIntermediateGroups = [
      { code: 'MPC', label: 'MPC', order: 1, active: true },
      { code: 'BIPC', label: 'BiPC', order: 2, active: true },
      { code: 'CEC', label: 'CEC', order: 3, active: true },
      { code: 'MEC', label: 'MEC', order: 4, active: true },
    ];
    const defaultJoinedCollegeOptions = [
      { code: 'SELF', label: 'Self College', order: 1, active: true },
      { code: 'OTHERS', label: 'Others', order: 2, active: true },
    ];

    await db.collection('tenantConfig').doc(tenantId).set({
      tenantId,
      statusOptions: defaultStatusOptions,
      intermediateGroups: defaultIntermediateGroups,
      joinedCollegeOptions: defaultJoinedCollegeOptions,
      updatedAt: now,
    });

    return { success: true, tenantId, adminUid: uid };
  } catch (e: any) {
    await tenantRef.delete();
    try { await auth.deleteUser(uid); } catch (_) {}
    throw new functions.https.HttpsError('internal', `Failed to set up admin: ${e.message}`);
  }
}

export async function adminUpdateTenantHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireSuperAdmin(token);

  const { tenantId, updateData } = payload;
  if (!tenantId) throw new functions.https.HttpsError('invalid-argument', 'tenantId required');

  await db.collection('tenants').doc(tenantId).update({
    ...updateData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
}

export async function syncClaimsHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  const uid = token.uid;

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new functions.https.HttpsError('not-found', 'User not found');

  const userData = userDoc.data()!;
  const customClaims: Record<string, any> = {
    role: userData.role,
    tenantId: userData.tenantId,
  };
  if (userData.teamId) customClaims.teamId = userData.teamId;

  await auth.setCustomUserClaims(uid, customClaims);
  return { success: true, claims: customClaims };
}

// ═══════════════════════════════════════════════════════════════════════
// USERNAME RESOLUTION (unauthenticated — used during login)
// ═══════════════════════════════════════════════════════════════════════

export async function resolveUsernameToEmailHandler(payload: any, _request: any) {
  const { username, tenantId } = payload;
  if (!username || typeof username !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid request');
  }
  const u = username.toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(u) || u.includes('__')) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  await checkRateLimit(db, `resolveUsername:${u}`, 10);

  if (tenantId) {
    const snap = await db.doc(`usernameIndex/${tenantId}__${u}`).get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    return { email: snap.data()!.email };
  }
  const q = await db.collection('usernameIndex').where('username', '==', u).limit(2).get();
  if (q.empty) throw new functions.https.HttpsError('not-found', 'User not found');
  if (q.size > 1) throw new functions.https.HttpsError('failed-precondition', 'Tenant required');
  return { email: q.docs[0].data().email };
}

// ═══════════════════════════════════════════════════════════════════════
// RESET TENANT DATA (Admin only — for seeding / demo reset)
// ═══════════════════════════════════════════════════════════════════════

export async function resetTenantDataHandler(payload: any, request: CallableRequest) {
  const token = await verifyAuthToken(request);
  requireAdminOrManager(token);
  const tenantId = token.tenantId as string;

  const { confirm } = payload;
  if (confirm !== 'DELETE_ALL_DATA') {
    throw new functions.https.HttpsError('invalid-argument', 'Must pass confirm: "DELETE_ALL_DATA"');
  }

  let deleted = { leads: 0, leadAssignments: 0, teams: 0, divisions: 0, reminders: 0 };

  // Helper: delete all docs in a query
  async function deleteQuery(snap: admin.firestore.QuerySnapshot) {
    const ops = snap.docs.map(d => (b: admin.firestore.WriteBatch) => b.delete(d.ref));
    await commitInChunks(db, ops);
    return snap.size;
  }

  // Delete leads + their statusUpdates subcollections
  const leadSnap = await db.collection('leads').where('tenantId', '==', tenantId).get();
  // Delete statusUpdates subcollection for each lead first
  for (const leadDoc of leadSnap.docs) {
    const subSnap = await leadDoc.ref.collection('statusUpdates').get();
    if (subSnap.size > 0) {
      const subOps = subSnap.docs.map(d => (b: admin.firestore.WriteBatch) => b.delete(d.ref));
      await commitInChunks(db, subOps);
    }
  }
  deleted.leads = await deleteQuery(leadSnap);

  // Delete leadAssignments
  const laSnap = await db.collection('leadAssignments').where('tenantId', '==', tenantId).get();
  deleted.leadAssignments = await deleteQuery(laSnap);

  // Delete reminders
  const remSnap = await db.collection('reminders').where('tenantId', '==', tenantId).get();
  deleted.reminders = await deleteQuery(remSnap);

  // Delete teams
  const teamSnap = await db.collection('teams').where('tenantId', '==', tenantId).get();
  deleted.teams = await deleteQuery(teamSnap);

  // Delete divisions
  const divSnap = await db.collection('divisions').where('tenantId', '==', tenantId).get();
  deleted.divisions = await deleteQuery(divSnap);

  // Clear teamId / assignedDivisionIds on PRO user docs, then delete them + Auth accounts
  const proSnap = await db.collection('users')
    .where('tenantId', '==', tenantId)
    .where('role', '==', 'PRO')
    .get();
  const proUsernames = proSnap.docs.map(d => d.data().username).filter(Boolean) as string[];
  for (const d of proSnap.docs) {
    try { await auth.deleteUser(d.id); } catch (_) { /* already gone */ }
  }
  const deleteProOps = proSnap.docs.map(d => (b: admin.firestore.WriteBatch) => b.delete(d.ref));
  await commitInChunks(db, deleteProOps);

  // Delete usernameIndex entries for deleted PRO users
  // Use document IDs directly: {tenantId}__{username}
  if (proUsernames.length > 0) {
    const idxRefs = proUsernames.map(u => db.collection('usernameIndex').doc(`${tenantId}__${u}`));
    const deleteIdxOps = idxRefs.map(ref => (b: admin.firestore.WriteBatch) => b.delete(ref));
    await commitInChunks(db, deleteIdxOps);
  }

  return { success: true, deleted };
}
