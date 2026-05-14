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
exports.RESERVED_USERNAMES = void 0;
exports.verifyAuthToken = verifyAuthToken;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requireAdminOrManager = requireAdminOrManager;
exports.requirePROOrAbove = requirePROOrAbove;
exports.isAdminOrManager = isAdminOrManager;
exports.cleanPhoneStr = cleanPhoneStr;
exports.checkRateLimit = checkRateLimit;
exports.isAlreadyProcessed = isAlreadyProcessed;
exports.commitInChunks = commitInChunks;
exports.validateUsername = validateUsername;
exports.validateUniqueLeadId = validateUniqueLeadId;
exports.buildLeadAssignmentSearchFields = buildLeadAssignmentSearchFields;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// ─── Auth Verification ───────────────────────────────────────────────────
async function verifyAuthToken(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    return context.auth.token;
}
// ─── RBAC Helpers ────────────────────────────────────────────────────────
function requireSuperAdmin(token) {
    if (token.role !== 'SUPER_ADMIN') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin role required');
    }
}
function requireAdminOrManager(token) {
    const role = token.role;
    if (role !== 'COLLEGE_ADMIN' && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
        throw new functions.https.HttpsError('permission-denied', 'Admin or Manager role required');
    }
}
function requirePROOrAbove(token) {
    const role = token.role;
    if (role !== 'PRO' && role !== 'COLLEGE_ADMIN' && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }
}
function isAdminOrManager(role) {
    return role === 'COLLEGE_ADMIN' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}
// ─── Phone Cleaning ─────────────────────────────────────────────────────
/**
 * Normalizes an Indian phone number to 10 digits.
 * Strips country code "91" prefix, invisible Unicode chars, non-digits.
 * Returns empty string if result is not 10 digits.
 */
function cleanPhoneStr(phone) {
    if (!phone)
        return '';
    let digits = phone
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
        .replace(/\D/g, ''); // non-digits
    // Strip leading 91 country code
    if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.slice(2);
    }
    return digits.length === 10 ? digits : '';
}
// ─── Rate Limiting ───────────────────────────────────────────────────────
async function checkRateLimit(db, key, maxPerMinute = 1) {
    var _a, _b;
    const ref = db.collection('_rateLimits').doc(key);
    const doc = await ref.get();
    if (doc.exists) {
        const data = doc.data();
        const lastMinute = Date.now() - 60000;
        if (((_b = (_a = data.timestamp) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) > lastMinute && data.count >= maxPerMinute) {
            throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please wait a moment before trying again.');
        }
    }
    await ref.set({
        count: (doc.exists ? (doc.data().count || 0) + 1 : 1),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}
// ─── Idempotency ─────────────────────────────────────────────────────────
async function isAlreadyProcessed(db, eventId) {
    const ref = db.collection('_processedEvents').doc(eventId);
    const doc = await ref.get();
    if (doc.exists)
        return true;
    await ref.set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        // TTL handled by cloud function or manual cleanup (72h)
    });
    return false;
}
// ─── Batched Commits ─────────────────────────────────────────────────────
/**
 * Writes an array of Firestore operations in batches of `batchSize`.
 * Returns the total number of commits made.
 */
async function commitInChunks(db, operations, batchSize = 400) {
    let commits = 0;
    for (let i = 0; i < operations.length; i += batchSize) {
        const batch = db.batch();
        const chunk = operations.slice(i, i + batchSize);
        chunk.forEach(op => op(batch));
        await batch.commit();
        commits++;
    }
    return commits;
}
// ─── Reserved Usernames ─────────────────────────────────────────────────
exports.RESERVED_USERNAMES = new Set([
    'admin', 'superadmin', 'root', 'system', 'support', 'null', 'undefined',
]);
function validateUsername(username) {
    if (!username || username.length < 3 || username.length > 30) {
        return 'Username must be 3-30 characters';
    }
    if (!/^[a-z0-9._-]+$/.test(username)) {
        return 'Username can only contain lowercase letters, numbers, dots, hyphens, and underscores';
    }
    if (username.includes('__')) {
        return 'Username cannot contain double underscores';
    }
    if (exports.RESERVED_USERNAMES.has(username.toLowerCase())) {
        return 'This username is reserved';
    }
    return null;
}
// ─── Lead ID Validation ─────────────────────────────────────────────────
function validateUniqueLeadId(id) {
    if (!id || id.trim().length === 0)
        return 'Lead ID cannot be empty';
    if (id.length > 64)
        return 'Lead ID must be 64 characters or fewer';
    if (/\s/.test(id))
        return 'Lead ID cannot contain whitespace';
    return null;
}
// ─── Lead Assignment Search Fields ──────────────────────────────────────
function buildLeadAssignmentSearchFields(lead, division) {
    const parentName = (lead.parentName || '').trim();
    const studentName = (lead.studentName || '').trim();
    const uid = String(lead.uniqueLeadId || '').trim();
    return {
        parentName,
        parentName_lowercase: parentName.toLowerCase(),
        studentName,
        studentName_lowercase: studentName.toLowerCase(),
        uniqueLeadId: uid,
        uniqueLeadId_lowercase: uid.toLowerCase(),
        parentPhone: cleanPhoneStr(lead.parentPhone),
        studentPhone: cleanPhoneStr(lead.studentPhone),
        divisionId: lead.divisionId || '',
        divisionName: (division === null || division === void 0 ? void 0 : division.name) || lead.divisionName || '',
    };
}
//# sourceMappingURL=utils.js.map