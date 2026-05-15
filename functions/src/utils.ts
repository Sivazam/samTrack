import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// ─── Auth Verification ───────────────────────────────────────────────────
export async function verifyAuthToken(
  context: any
): Promise<admin.auth.DecodedIdToken> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  return context.auth.token as admin.auth.DecodedIdToken;
}

// ─── RBAC Helpers ────────────────────────────────────────────────────────
export function requireSuperAdmin(token: admin.auth.DecodedIdToken): void {
  if (token.role !== 'SUPER_ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'Super Admin role required');
  }
}

export function requireAdminOrManager(token: admin.auth.DecodedIdToken): void {
  const role = token.role;
  if (role !== 'COLLEGE_ADMIN' && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'Admin or Manager role required');
  }
}

export function requirePROOrAbove(token: admin.auth.DecodedIdToken): void {
  const role = token.role;
  if (role !== 'PRO' && role !== 'COLLEGE_ADMIN' && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
  }
}

export function isAdminOrManager(role?: string): boolean {
  return role === 'COLLEGE_ADMIN' || role === 'MANAGER' || role === 'SUPER_ADMIN';
}

// ─── Phone Cleaning ─────────────────────────────────────────────────────
/**
 * Normalizes an Indian phone number to 10 digits.
 * Strips country code "91" prefix, invisible Unicode chars, non-digits.
 * Returns empty string if result is not 10 digits.
 */
export function cleanPhoneStr(phone?: string | null): string {
  if (!phone) return '';
  let digits = phone
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/\D/g, '');                     // non-digits
  // Strip leading 91 country code
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }
  return digits.length === 10 ? digits : '';
}

// ─── Rate Limiting ───────────────────────────────────────────────────────
export async function checkRateLimit(
  db: admin.firestore.Firestore,
  key: string,
  maxPerMinute: number = 1
): Promise<void> {
  const ref = db.collection('_rateLimits').doc(key);
  const doc = await ref.get();

  if (doc.exists) {
    const data = doc.data()!;
    const lastMinute = Date.now() - 60_000;
    if (data.timestamp?.toMillis?.() > lastMinute && data.count >= maxPerMinute) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Rate limit exceeded. Please wait a moment before trying again.'
      );
    }
  }

  await ref.set({
    count: (doc.exists ? (doc.data()!.count || 0) + 1 : 1),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── Idempotency ─────────────────────────────────────────────────────────
export async function isAlreadyProcessed(
  db: admin.firestore.Firestore,
  eventId: string
): Promise<boolean> {
  const ref = db.collection('_processedEvents').doc(eventId);
  const doc = await ref.get();
  if (doc.exists) return true;
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
export async function commitInChunks(
  db: admin.firestore.Firestore,
  operations: Array<(batch: admin.firestore.WriteBatch) => void>,
  batchSize: number = 400
): Promise<number> {
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
export const RESERVED_USERNAMES = new Set([
  'admin', 'superadmin', 'root', 'system', 'support', 'null', 'undefined',
]);

export function validateUsername(username: string): string | null {
  if (!username || username.length < 3 || username.length > 30) {
    return 'Username must be 3-30 characters';
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return 'Username can only contain lowercase letters, numbers, dots, hyphens, and underscores';
  }
  if (username.includes('__')) {
    return 'Username cannot contain double underscores';
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return 'This username is reserved';
  }
  return null;
}

// ─── Lead ID Validation ─────────────────────────────────────────────────
export function validateUniqueLeadId(id: string): string | null {
  if (!id || id.trim().length === 0) return 'Lead ID cannot be empty';
  if (id.length > 64) return 'Lead ID must be 64 characters or fewer';
  if (/\s/.test(id)) return 'Lead ID cannot contain whitespace';
  return null;
}

// ─── Lead Assignment Search Fields ──────────────────────────────────────
export function buildLeadAssignmentSearchFields(lead: any, division?: any): Record<string, any> {
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
    divisionName: division?.name || lead.divisionName || '',
  };
}
