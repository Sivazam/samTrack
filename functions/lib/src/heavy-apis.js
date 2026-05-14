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
exports.createUserHandler = createUserHandler;
exports.updateUserHandler = updateUserHandler;
exports.deactivateUserHandler = deactivateUserHandler;
exports.manageTeamHandler = manageTeamHandler;
exports.createLeadHandler = createLeadHandler;
exports.bulkCreateLeadsHandler = bulkCreateLeadsHandler;
exports.updateLeadHandler = updateLeadHandler;
exports.reassignLeadTeamHandler = reassignLeadTeamHandler;
exports.bulkReassignLeadsHandler = bulkReassignLeadsHandler;
exports.syncLeadAssignmentsHandler = syncLeadAssignmentsHandler;
exports.logStatusUpdateHandler = logStatusUpdateHandler;
exports.manageReminderHandler = manageReminderHandler;
exports.updateTenantConfigHandler = updateTenantConfigHandler;
exports.generateReportHandler = generateReportHandler;
exports.getDashboardStatsHandler = getDashboardStatsHandler;
exports.adminCreateTenantHandler = adminCreateTenantHandler;
exports.adminUpdateTenantHandler = adminUpdateTenantHandler;
exports.syncClaimsHandler = syncClaimsHandler;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const utils_1 = require("./utils");
const db = admin.firestore();
const auth = admin.auth();
// Helper to get division doc
async function getDivision(divisionId) {
    return db.collection('divisions').doc(divisionId).get();
}
// Helper to find team for a division
async function findTeamForDivision(tenantId, divisionId) {
    const snap = await db.collection('teams')
        .where('tenantId', '==', tenantId)
        .where('divisionIds', 'array-contains', divisionId)
        .where('active', '==', true)
        .limit(1)
        .get();
    return snap.empty ? null : snap.docs[0];
}
// Helper to get all admin/manager UIDs for a tenant
async function getTenantAdminManagerUids(tenantId) {
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
async function createUserHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    const { email, username, password, displayName, role, teamId, assignedDivisionIds, phone } = payload;
    // Validate
    if (!email || !username || !password || !displayName || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    const usernameError = (0, utils_1.validateUsername)(username);
    if (usernameError)
        throw new functions.https.HttpsError('invalid-argument', usernameError);
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
            throw new functions.https.HttpsError('already-exists', 'Username already taken');
        }
        // Create Auth user
        let uid;
        try {
            const userRecord = await auth.createUser({ email, password, displayName });
            uid = userRecord.uid;
        }
        catch (e) {
            throw new functions.https.HttpsError('internal', `Failed to create auth user: ${e.message}`);
        }
        try {
            // Set custom claims
            const customClaims = { role, tenantId };
            if (teamId)
                customClaims.teamId = teamId;
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
                createdAt: now,
            });
            return { success: true, uid };
        }
        catch (e) {
            // Roll back Auth user
            try {
                await auth.deleteUser(uid);
            }
            catch (_) { }
            throw new functions.https.HttpsError('internal', `Failed to create user: ${e.message}`);
        }
    });
}
async function updateUserHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const { userId, displayName, phone, role, teamId, assignedDivisionIds, active, username } = payload;
    if (!userId)
        throw new functions.https.HttpsError('invalid-argument', 'userId required');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists)
        throw new functions.https.HttpsError('not-found', 'User not found');
    const userData = userDoc.data();
    return db.runTransaction(async (tx) => {
        const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (displayName !== undefined)
            updates.displayName = displayName;
        if (phone !== undefined)
            updates.phone = phone;
        if (role !== undefined)
            updates.role = role;
        if (teamId !== undefined)
            updates.teamId = teamId;
        if (assignedDivisionIds !== undefined)
            updates.assignedDivisionIds = assignedDivisionIds;
        if (active !== undefined)
            updates.active = active;
        // Handle username change
        if (username !== undefined && username !== userData.username) {
            const usernameError = (0, utils_1.validateUsername)(username);
            if (usernameError)
                throw new functions.https.HttpsError('invalid-argument', usernameError);
            const newIndexId = `${userData.tenantId}__${username.toLowerCase()}`;
            const newIndexRef = db.collection('usernameIndex').doc(newIndexId);
            const newIndexDoc = await tx.get(newIndexRef);
            if (newIndexDoc.exists)
                throw new functions.https.HttpsError('already-exists', 'Username already taken');
            // Delete old index + create new
            const oldIndexId = `${userData.tenantId}__${userData.username}`;
            tx.delete(db.collection('usernameIndex').doc(oldIndexId));
            tx.set(newIndexRef, { uid: userId, email: userData.email, tenantId: userData.tenantId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            updates.username = username.toLowerCase();
        }
        tx.update(userRef, updates);
        // Update custom claims if role or teamId changed
        if (role !== undefined || teamId !== undefined) {
            const newRole = role || userData.role;
            const newTeamId = teamId !== undefined ? teamId : userData.teamId;
            const customClaims = { role: newRole, tenantId: userData.tenantId };
            if (newTeamId)
                customClaims.teamId = newTeamId;
            await auth.setCustomUserClaims(userId, customClaims);
        }
        // If deactivating, revoke tokens
        if (active === false) {
            await auth.revokeRefreshTokens(userId);
        }
        return { success: true };
    });
}
async function deactivateUserHandler(payload, request) {
    return updateUserHandler({ userId: payload.userId, active: false }, request);
}
// ═══════════════════════════════════════════════════════════════════════
// TEAM MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
async function manageTeamHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    const { subAction, teamId, name, memberUids, divisionIds } = payload;
    if (subAction === 'create') {
        if (!name || !memberUids || memberUids.length < 1) {
            throw new functions.https.HttpsError('invalid-argument', 'Name and at least 1 member required');
        }
        if (memberUids.length > 2) {
            throw new functions.https.HttpsError('invalid-argument', 'Team can have at most 2 members');
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
        return { success: true, teamId: teamRef.id };
    }
    if (subAction === 'update') {
        if (!teamId)
            throw new functions.https.HttpsError('invalid-argument', 'teamId required');
        const teamRef = db.collection('teams').doc(teamId);
        const teamDoc = await teamRef.get();
        if (!teamDoc.exists)
            throw new functions.https.HttpsError('not-found', 'Team not found');
        const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (name !== undefined)
            updates.name = name;
        if (memberUids !== undefined) {
            if (memberUids.length < 1 || memberUids.length > 2) {
                throw new functions.https.HttpsError('invalid-argument', 'Team must have 1-2 members');
            }
            updates.memberUids = memberUids;
        }
        if (divisionIds !== undefined)
            updates.divisionIds = divisionIds;
        await teamRef.update(updates);
        // Update leadAssignments
        const finalMemberUids = memberUids || teamDoc.data().memberUids;
        const finalDivisionIds = divisionIds || teamDoc.data().divisionIds;
        await updateAssignmentsForTeams(tenantId, teamId, finalMemberUids, finalDivisionIds);
        return { success: true };
    }
    if (subAction === 'dissolve') {
        if (!teamId)
            throw new functions.https.HttpsError('invalid-argument', 'teamId required');
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
        const ops = snap.docs.map(d => (batch) => {
            batch.update(d.ref, { teamId: admin.firestore.FieldValue.delete(), assignedPROUids: [], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        await (0, utils_1.commitInChunks)(db, ops);
        return { success: true, clearedAssignments: snap.size };
    }
    throw new functions.https.HttpsError('invalid-argument', `Unknown subAction: ${subAction}`);
}
async function updateAssignmentsForTeams(tenantId, teamId, memberUids, divisionIds) {
    for (const divId of divisionIds) {
        const snap = await db.collection('leadAssignments')
            .where('tenantId', '==', tenantId)
            .where('divisionId', '==', divId)
            .where('active', '==', true)
            .get();
        const ops = snap.docs.map(d => (batch) => {
            batch.update(d.ref, {
                teamId,
                assignedPROUids: memberUids,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await (0, utils_1.commitInChunks)(db, ops);
        // Also update leads collection
        const leadSnap = await db.collection('leads')
            .where('tenantId', '==', tenantId)
            .where('divisionId', '==', divId)
            .where('active', '==', true)
            .get();
        const leadOps = leadSnap.docs.map(d => (batch) => {
            batch.update(d.ref, {
                teamId,
                assignedPROUids: memberUids,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await (0, utils_1.commitInChunks)(db, leadOps);
    }
}
// ═══════════════════════════════════════════════════════════════════════
// LEAD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════
async function createLeadHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    const { uniqueLeadId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionId } = payload;
    if (!uniqueLeadId || !parentName || !studentName || !divisionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: uniqueLeadId, parentName, studentName, divisionId');
    }
    const idError = (0, utils_1.validateUniqueLeadId)(uniqueLeadId);
    if (idError)
        throw new functions.https.HttpsError('invalid-argument', idError);
    // Check uniqueness
    const existing = await db.collection('leads')
        .where('tenantId', '==', tenantId)
        .where('uniqueLeadId', '==', uniqueLeadId)
        .limit(1)
        .get();
    if (!existing.empty) {
        throw new functions.https.HttpsError('already-exists', `Lead with ID '${uniqueLeadId}' already exists`);
    }
    // Get division name
    const divisionDoc = await getDivision(divisionId);
    if (!divisionDoc.exists)
        throw new functions.https.HttpsError('not-found', 'Division not found');
    const divisionData = divisionDoc.data();
    const divisionName = divisionData.name;
    // Find team for division
    let teamId = null;
    let assignedPROUids = [];
    const teamDoc = await findTeamForDivision(tenantId, divisionId);
    if (teamDoc) {
        teamId = teamDoc.id;
        assignedPROUids = teamDoc.data().memberUids || [];
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const leadRef = db.collection('leads').doc();
    const leadId = leadRef.id;
    const cleanedParentPhone = (0, utils_1.cleanPhoneStr)(parentPhone);
    const cleanedStudentPhone = (0, utils_1.cleanPhoneStr)(studentPhone);
    const leadData = {
        tenantId,
        uniqueLeadId,
        uniqueLeadId_lowercase: uniqueLeadId.toLowerCase(),
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
    const searchFields = (0, utils_1.buildLeadAssignmentSearchFields)(leadData, divisionData);
    // Write lead + assignment in batch
    const batch = db.batch();
    batch.set(leadRef, leadData);
    const assignmentId = `${tenantId}__${leadId}`;
    batch.set(db.collection('leadAssignments').doc(assignmentId), Object.assign(Object.assign({ tenantId,
        leadId,
        teamId,
        assignedPROUids }, searchFields), { lastStatusCode: null, nextFollowupAt: null, active: true, createdAt: now, updatedAt: now }));
    await batch.commit();
    return { success: true, leadId };
}
async function bulkCreateLeadsHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    // Rate limit: 1 import per minute
    await (0, utils_1.checkRateLimit)(db, `bulkImport_${tenantId}`, 1);
    const { rows, sourceFilename, cityFromFilename, mode = 'skip' } = payload;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'rows array required');
    }
    const batchId = db.collection('importBatches').doc().id;
    let successRows = 0;
    let errorRows = 0;
    const errors = [];
    // Process in chunks of 400
    for (let i = 0; i < rows.length; i += 400) {
        const chunk = rows.slice(i, i + 400);
        const writeBatch = db.batch();
        const now = admin.firestore.FieldValue.serverTimestamp();
        for (let j = 0; j < chunk.length; j++) {
            const row = chunk[j];
            const rowNum = i + j + 1;
            try {
                const { uniqueLeadId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionName, divisionId: rowDivId } = row;
                if (!uniqueLeadId || !parentName || !studentName) {
                    errors.push({ row: rowNum, uniqueLeadId, reason: 'Missing required fields' });
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
                    }
                    else {
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
                let teamId = null;
                let assignedPROUids = [];
                if (divId) {
                    const teamDoc = await findTeamForDivision(tenantId, divId);
                    if (teamDoc) {
                        teamId = teamDoc.id;
                        assignedPROUids = teamDoc.data().memberUids || [];
                    }
                }
                const leadRef = db.collection('leads').doc();
                const leadId = leadRef.id;
                const leadData = {
                    tenantId,
                    uniqueLeadId,
                    uniqueLeadId_lowercase: uniqueLeadId.toLowerCase(),
                    parentName: parentName.trim(),
                    parentName_lowercase: parentName.trim().toLowerCase(),
                    studentName: studentName.trim(),
                    studentName_lowercase: studentName.trim().toLowerCase(),
                    parentPhone: (0, utils_1.cleanPhoneStr)(parentPhone) || null,
                    studentPhone: (0, utils_1.cleanPhoneStr)(studentPhone) || null,
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
                const searchFields = (0, utils_1.buildLeadAssignmentSearchFields)(leadData);
                writeBatch.set(leadRef, leadData);
                writeBatch.set(db.collection('leadAssignments').doc(`${tenantId}__${leadId}`), Object.assign(Object.assign({ tenantId, leadId, teamId, assignedPROUids }, searchFields), { lastStatusCode: null, nextFollowupAt: null, active: true, createdAt: now, updatedAt: now }));
                successRows++;
            }
            catch (e) {
                errors.push({ row: rowNum, uniqueLeadId: row.uniqueLeadId, reason: e.message || 'Unknown error' });
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
async function updateLeadHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const { leadId, parentName, studentName, parentPhone, studentPhone, intermediateGroup, address, divisionId, active } = payload;
    if (!leadId)
        throw new functions.https.HttpsError('invalid-argument', 'leadId required');
    const leadRef = db.collection('leads').doc(leadId);
    const leadDoc = await leadRef.get();
    if (!leadDoc.exists)
        throw new functions.https.HttpsError('not-found', 'Lead not found');
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (parentName !== undefined) {
        updates.parentName = parentName.trim();
        updates.parentName_lowercase = parentName.trim().toLowerCase();
    }
    if (studentName !== undefined) {
        updates.studentName = studentName.trim();
        updates.studentName_lowercase = studentName.trim().toLowerCase();
    }
    if (parentPhone !== undefined)
        updates.parentPhone = (0, utils_1.cleanPhoneStr)(parentPhone) || null;
    if (studentPhone !== undefined)
        updates.studentPhone = (0, utils_1.cleanPhoneStr)(studentPhone) || null;
    if (intermediateGroup !== undefined)
        updates.intermediateGroup = intermediateGroup;
    if (address !== undefined)
        updates.address = address;
    if (active !== undefined)
        updates.active = active;
    let divisionChanged = false;
    let newDivisionName = leadDoc.data().divisionName;
    let newDivisionId = divisionId || leadDoc.data().divisionId;
    let newTeamId = leadDoc.data().teamId;
    let newAssignedPROUids = leadDoc.data().assignedPROUids || [];
    if (divisionId && divisionId !== leadDoc.data().divisionId) {
        divisionChanged = true;
        const divDoc = await getDivision(divisionId);
        if (!divDoc.exists)
            throw new functions.https.HttpsError('not-found', 'Division not found');
        newDivisionName = divDoc.data().name;
        updates.divisionId = divisionId;
        updates.divisionName = newDivisionName;
        // Reassign to team for new division
        const teamDoc = await findTeamForDivision(leadDoc.data().tenantId, divisionId);
        if (teamDoc) {
            newTeamId = teamDoc.id;
            newAssignedPROUids = teamDoc.data().memberUids || [];
        }
        else {
            newTeamId = null;
            newAssignedPROUids = [];
        }
        updates.teamId = newTeamId;
        updates.assignedPROUids = newAssignedPROUids;
    }
    await leadRef.update(updates);
    // Sync to leadAssignments
    const assignmentId = `${leadDoc.data().tenantId}__${leadId}`;
    const assignmentRef = db.collection('leadAssignments').doc(assignmentId);
    const assignmentUpdates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (parentName !== undefined) {
        assignmentUpdates.parentName = parentName.trim();
        assignmentUpdates.parentName_lowercase = parentName.trim().toLowerCase();
    }
    if (studentName !== undefined) {
        assignmentUpdates.studentName = studentName.trim();
        assignmentUpdates.studentName_lowercase = studentName.trim().toLowerCase();
    }
    if (parentPhone !== undefined)
        assignmentUpdates.parentPhone = (0, utils_1.cleanPhoneStr)(parentPhone) || null;
    if (studentPhone !== undefined)
        assignmentUpdates.studentPhone = (0, utils_1.cleanPhoneStr)(studentPhone) || null;
    if (divisionChanged) {
        assignmentUpdates.divisionId = newDivisionId;
        assignmentUpdates.divisionName = newDivisionName;
        assignmentUpdates.teamId = newTeamId;
        assignmentUpdates.assignedPROUids = newAssignedPROUids;
    }
    if (active !== undefined)
        assignmentUpdates.active = active;
    await assignmentRef.update(assignmentUpdates);
    return { success: true };
}
async function reassignLeadTeamHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const { leadId, toTeamId } = payload;
    if (!leadId || !toTeamId)
        throw new functions.https.HttpsError('invalid-argument', 'leadId and toTeamId required');
    const teamDoc = await db.collection('teams').doc(toTeamId).get();
    if (!teamDoc.exists)
        throw new functions.https.HttpsError('not-found', 'Team not found');
    const teamData = teamDoc.data();
    const leadRef = db.collection('leads').doc(leadId);
    const leadDoc = await leadRef.get();
    if (!leadDoc.exists)
        throw new functions.https.HttpsError('not-found', 'Lead not found');
    const now = admin.firestore.FieldValue.serverTimestamp();
    await leadRef.update({
        teamId: toTeamId,
        assignedPROUids: teamData.memberUids || [],
        updatedAt: now,
    });
    // Sync assignment
    const assignmentId = `${leadDoc.data().tenantId}__${leadId}`;
    await db.collection('leadAssignments').doc(assignmentId).update({
        teamId: toTeamId,
        assignedPROUids: teamData.memberUids || [],
        updatedAt: now,
    });
    return { success: true };
}
async function bulkReassignLeadsHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    const { divisionId, fromTeamId, toTeamId, leadIds } = payload;
    if (!toTeamId)
        throw new functions.https.HttpsError('invalid-argument', 'toTeamId required');
    const teamDoc = await db.collection('teams').doc(toTeamId).get();
    if (!teamDoc.exists)
        throw new functions.https.HttpsError('not-found', 'Team not found');
    const memberUids = teamDoc.data().memberUids || [];
    // Build query
    let query = db.collection('leadAssignments')
        .where('tenantId', '==', tenantId)
        .where('active', '==', true);
    if (leadIds && leadIds.length > 0) {
        // Specific leads
        const ops = [];
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
        await (0, utils_1.commitInChunks)(db, ops);
        return { success: true, reassigned: leadIds.length };
    }
    if (divisionId) {
        query = query.where('divisionId', '==', divisionId);
    }
    if (fromTeamId) {
        query = query.where('teamId', '==', fromTeamId);
    }
    const snap = await query.get();
    const ops = snap.docs.map(d => (batch) => {
        const data = d.data();
        batch.update(d.ref, { teamId: toTeamId, assignedPROUids: memberUids, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.update(db.collection('leads').doc(data.leadId), { teamId: toTeamId, assignedPROUids: memberUids, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await (0, utils_1.commitInChunks)(db, ops);
    return { success: true, reassigned: snap.size };
}
async function syncLeadAssignmentsHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireSuperAdmin)(token);
    const tenantId = payload.tenantId || token.tenantId;
    const leadsSnap = await db.collection('leads').where('tenantId', '==', tenantId).get();
    const ops = [];
    for (const leadDoc of leadsSnap.docs) {
        const lead = leadDoc.data();
        const divDoc = lead.divisionId ? await getDivision(lead.divisionId) : null;
        const searchFields = (0, utils_1.buildLeadAssignmentSearchFields)(lead, divDoc === null || divDoc === void 0 ? void 0 : divDoc.data());
        const assignmentId = `${tenantId}__${leadDoc.id}`;
        ops.push((batch) => {
            batch.set(db.collection('leadAssignments').doc(assignmentId), Object.assign(Object.assign({ tenantId, leadId: leadDoc.id, teamId: lead.teamId || null, assignedPROUids: lead.assignedPROUids || [] }, searchFields), { lastStatusCode: lead.lastStatusCode || null, nextFollowupAt: lead.nextFollowupAt || null, active: lead.active !== false, createdAt: lead.createdAt || admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
        });
    }
    const commits = await (0, utils_1.commitInChunks)(db, ops);
    return { success: true, synced: leadsSnap.size, commits };
}
// ═══════════════════════════════════════════════════════════════════════
// STATUS UPDATES
// ═══════════════════════════════════════════════════════════════════════
async function logStatusUpdateHandler(payload, request) {
    var _a, _b;
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requirePROOrAbove)(token);
    const tenantId = token.tenantId;
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
    if (!leadDoc.exists)
        throw new functions.https.HttpsError('not-found', 'Lead not found');
    const leadData = leadDoc.data();
    // Verify PRO is assigned to this lead
    if (!(0, utils_1.isAdminOrManager)(token.role) && !((_a = leadData.assignedPROUids) === null || _a === void 0 ? void 0 : _a.includes(token.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'Not assigned to this lead');
    }
    // Get status label from tenantConfig
    let statusLabel = statusCode;
    try {
        const configDoc = await db.collection('tenantConfig').doc(tenantId).get();
        if (configDoc.exists) {
            const option = (_b = configDoc.data().statusOptions) === null || _b === void 0 ? void 0 : _b.find((o) => o.code === statusCode);
            if (option)
                statusLabel = option.label;
        }
    }
    catch (_) { }
    // Get user info
    const userDoc = await db.collection('users').doc(token.uid).get();
    const userName = userDoc.exists ? userDoc.data().displayName : 'Unknown';
    let accompanyingName;
    if (accompanyingMemberUid) {
        const mateDoc = await db.collection('users').doc(accompanyingMemberUid).get();
        accompanyingName = mateDoc.exists ? mateDoc.data().displayName : undefined;
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const updateRef = leadRef.collection('statusUpdates').doc();
    const statusUpdateData = {
        tenantId,
        leadId,
        approachType,
        statusCode,
        statusLabel,
        comments: comments || null,
        parentPhone: parentPhone || leadData.parentPhone,
        studentPhone: studentPhone || leadData.studentPhone,
        intermediateGroup: intermediateGroup || leadData.intermediateGroup,
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
    const leadUpdates = {
        lastStatusCode: statusCode,
        lastStatusLabel: statusLabel,
        lastStatusAt: now,
        lastApproachType: approachType,
        lastUpdatedByUid: token.uid,
        lastUpdatedByTeamId: leadData.teamId || null,
        updatedAt: now,
    };
    if (joinedCollegeName)
        leadUpdates.joinedCollegeName = joinedCollegeName;
    // Write status update + update lead in batch
    const batch = db.batch();
    batch.set(updateRef, statusUpdateData);
    batch.update(leadRef, leadUpdates);
    // Also update leadAssignment lastStatusCode
    const assignmentId = `${tenantId}__${leadId}`;
    batch.update(db.collection('leadAssignments').doc(assignmentId), {
        lastStatusCode: statusCode,
        updatedAt: now,
    });
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
    }
    catch (_) { }
    return { success: true, updateId: updateRef.id };
}
// ═══════════════════════════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════════════════════════
async function manageReminderHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requirePROOrAbove)(token);
    const tenantId = token.tenantId;
    const { subAction, reminderId, leadId, dueAt, dueDateOnly, note, snoozeDuration } = payload;
    if (subAction === 'create') {
        if (!leadId || !dueAt)
            throw new functions.https.HttpsError('invalid-argument', 'leadId and dueAt required');
        const leadDoc = await db.collection('leads').doc(leadId).get();
        if (!leadDoc.exists)
            throw new functions.https.HttpsError('not-found', 'Lead not found');
        const leadData = leadDoc.data();
        const userDoc = await db.collection('users').doc(token.uid).get();
        const userName = userDoc.exists ? userDoc.data().displayName : 'Unknown';
        // Compute recipient UIDs: team members + all admins/managers
        const adminManagerUids = await getTenantAdminManagerUids(tenantId);
        let teamMemberUids = leadData.assignedPROUids || [];
        const recipientUids = [...new Set([...teamMemberUids, ...adminManagerUids])];
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
            recipientUids,
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
        if (!reminderId)
            throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
        const reminderDoc = await db.collection('reminders').doc(reminderId).get();
        if (!reminderDoc.exists)
            throw new functions.https.HttpsError('not-found', 'Reminder not found');
        const reminderData = reminderDoc.data();
        // Calculate snooze time
        let snoozeDate;
        if (snoozeDuration === '1h') {
            snoozeDate = new Date(Date.now() + 60 * 60 * 1000);
        }
        else if (snoozeDuration === 'tomorrow') {
            snoozeDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            snoozeDate.setHours(9, 0, 0, 0);
        }
        else {
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
        if (!reminderId)
            throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
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
        if (!reminderId)
            throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
        await db.collection('reminders').doc(reminderId).update({
            status: 'CANCELLED',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    if (subAction === 'update') {
        if (!reminderId)
            throw new functions.https.HttpsError('invalid-argument', 'reminderId required');
        const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (dueAt !== undefined)
            updates.dueAt = admin.firestore.Timestamp.fromDate(new Date(dueAt));
        if (dueDateOnly !== undefined)
            updates.dueDateOnly = dueDateOnly;
        if (note !== undefined)
            updates.note = note;
        await db.collection('reminders').doc(reminderId).update(updates);
        return { success: true };
    }
    throw new functions.https.HttpsError('invalid-argument', `Unknown subAction: ${subAction}`);
}
// ═══════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════
async function updateTenantConfigHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    const { statusOptions, intermediateGroups, joinedCollegeOptions } = payload;
    // Validate code uniqueness within each list
    if (statusOptions) {
        const codes = statusOptions.map((o) => o.code);
        if (new Set(codes).size !== codes.length) {
            throw new functions.https.HttpsError('invalid-argument', 'Duplicate status codes found');
        }
    }
    if (intermediateGroups) {
        const codes = intermediateGroups.map((o) => o.code);
        if (new Set(codes).size !== codes.length) {
            throw new functions.https.HttpsError('invalid-argument', 'Duplicate intermediate group codes found');
        }
    }
    if (joinedCollegeOptions) {
        const codes = joinedCollegeOptions.map((o) => o.code);
        if (new Set(codes).size !== codes.length) {
            throw new functions.https.HttpsError('invalid-argument', 'Duplicate joined college codes found');
        }
    }
    const updates = {
        tenantId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUid: token.uid,
    };
    if (statusOptions)
        updates.statusOptions = statusOptions;
    if (intermediateGroups)
        updates.intermediateGroups = intermediateGroups;
    if (joinedCollegeOptions)
        updates.joinedCollegeOptions = joinedCollegeOptions;
    await db.collection('tenantConfig').doc(tenantId).set(updates, { merge: true });
    return { success: true };
}
// ═══════════════════════════════════════════════════════════════════════
// REPORTS & DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
async function generateReportHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireAdminOrManager)(token);
    const tenantId = token.tenantId;
    const { type, startDate, endDate, divisionId, teamId, proUid } = payload;
    switch (type) {
        case 'daily_activity': {
            // Query statusUpdates for date range
            let query = db.collectionGroup('statusUpdates')
                .where('tenantId', '==', tenantId);
            if (startDate)
                query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)));
            if (endDate)
                query = query.where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)));
            query = query.orderBy('createdAt', 'desc').limit(5000);
            const snap = await query.get();
            const byPRO = {};
            const byTeam = {};
            const byApproach = { PHONE: 0, DOORSTEP: 0, WALK_IN: 0, ONLINE: 0 };
            snap.docs.forEach(d => {
                const data = d.data();
                byPRO[data.loggedByUid] = (byPRO[data.loggedByUid] || 0) + 1;
                if (data.teamId)
                    byTeam[data.teamId] = (byTeam[data.teamId] || 0) + 1;
                if (data.approachType && byApproach[data.approachType] !== undefined)
                    byApproach[data.approachType]++;
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
            const overdue = reminderSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
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
async function getDashboardStatsHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    const tenantId = token.tenantId;
    if (!tenantId)
        throw new functions.https.HttpsError('permission-denied', 'No tenant');
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
async function adminCreateTenantHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireSuperAdmin)(token);
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
    let uid;
    try {
        const userRecord = await auth.createUser({ email: adminEmail, password: adminPassword, displayName: adminDisplayName || adminEmail });
        uid = userRecord.uid;
    }
    catch (e) {
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
            uid, email: adminEmail, tenantId, createdAt: now,
        });
        return { success: true, tenantId, adminUid: uid };
    }
    catch (e) {
        await tenantRef.delete();
        try {
            await auth.deleteUser(uid);
        }
        catch (_) { }
        throw new functions.https.HttpsError('internal', `Failed to set up admin: ${e.message}`);
    }
}
async function adminUpdateTenantHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    (0, utils_1.requireSuperAdmin)(token);
    const { tenantId, updateData } = payload;
    if (!tenantId)
        throw new functions.https.HttpsError('invalid-argument', 'tenantId required');
    await db.collection('tenants').doc(tenantId).update(Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
    return { success: true };
}
async function syncClaimsHandler(payload, request) {
    const token = await (0, utils_1.verifyAuthToken)(request);
    const uid = token.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists)
        throw new functions.https.HttpsError('not-found', 'User not found');
    const userData = userDoc.data();
    const customClaims = {
        role: userData.role,
        tenantId: userData.tenantId,
    };
    if (userData.teamId)
        customClaims.teamId = userData.teamId;
    await auth.setCustomUserClaims(uid, customClaims);
    return { success: true, claims: customClaims };
}
//# sourceMappingURL=heavy-apis.js.map