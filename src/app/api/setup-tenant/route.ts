import { NextResponse } from 'next/server';
import { getFirebaseFirestore } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const DEFAULT_STATUS_OPTIONS = [
  { code: 'WAITING_EAMCET', label: 'Waiting EAMCET', color: '#3b82f6', isTerminal: false, order: 1, active: true },
  { code: 'WAITING_NEET', label: 'Waiting NEET', color: '#8b5cf6', isTerminal: false, order: 2, active: true },
  { code: 'WILLING_DEGREE', label: 'Willing Degree', color: '#22c55e', isTerminal: false, order: 3, active: true },
  { code: 'NOT_INTERESTED_DEGREE', label: 'Not Willing - Degree', color: '#dc2626', isTerminal: true, order: 4, active: true },
  { code: 'WILLING_SAMHITHA', label: 'Willing Samhitha', color: '#10b981', isTerminal: false, order: 5, active: true },
  { code: 'WILLING_OTHER_COLLEGE', label: 'Willing Other College', color: '#f59e0b', isTerminal: false, order: 6, active: true },
  { code: 'JOINED_SAMHITHA', label: 'Joined Samhitha', color: '#16a34a', isTerminal: true, order: 7, active: true },
  { code: 'JOINED_OTHER', label: 'Joined Other', color: '#f97316', isTerminal: true, order: 8, active: true },
  { code: 'NOT_INTERESTED_SAMHITHA', label: 'Not Willing - Samhitha', color: '#dc2626', isTerminal: true, order: 9, active: true },
  { code: 'NOT_DECIDED', label: 'Not Decided', color: '#6b7280', isTerminal: false, order: 10, active: true },
  { code: 'PHONE_UNREACHABLE', label: 'Phone Unreachable', color: '#9ca3af', isTerminal: false, order: 11, active: true },
  { code: 'NOT_ANSWERING', label: 'Not Answering', color: '#78716c', isTerminal: false, order: 12, active: true },
  { code: 'REVISIT_NEEDED', label: 'Revisit Needed', color: '#fb923c', isTerminal: false, order: 13, active: true },
];

const DEFAULT_INTERMEDIATE_GROUPS = [
  { code: 'MPC', label: 'MPC', order: 1, active: true },
  { code: 'BIPC', label: 'BiPC', order: 2, active: true },
  { code: 'CEC', label: 'CEC', order: 3, active: true },
  { code: 'MEC', label: 'MEC', order: 4, active: true },
  { code: 'OTHERS', label: 'Others', order: 5, active: true },
];

const DEFAULT_JOINED_COLLEGE_OPTIONS = [
  { code: 'SAMHITHA', label: 'Samhitha College', order: 1, active: true },
  { code: 'OTHERS', label: 'Others', order: 2, active: true },
];

export async function POST(request: Request) {
  try {
    const { uid, email, username, displayName, phone, secretCode } = await request.json();

    if (secretCode !== 'samhitha2025') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const db = getFirebaseFirestore();
    const batch = db.batch();
    const tenantId = 'samhitha-college';

    // 1. Tenant
    const tenantRef = db.collection('tenants').doc(tenantId);
    batch.set(tenantRef, {
      name: 'Samhitha College',
      type: 'COLLEGE',
      status: 'ACTIVE',
      fcmDevices: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. User
    const userRef = db.collection('users').doc(uid);
    batch.set(userRef, {
      tenantId: null,
      email,
      username,
      displayName,
      phone: phone || null,
      role: 'SUPER_ADMIN',
      teamId: null,
      assignedDivisionIds: [],
      active: true,
      fcmDevices: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Username Index
    const indexRef = db.collection('usernameIndex').doc(`global__${username}`);
    batch.set(indexRef, {
      uid,
      email,
      tenantId: null,
      isGlobalAdmin: true,
      username,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Config
    const configRef = db.collection('tenantConfig').doc(tenantId);
    batch.set(configRef, {
      tenantId,
      statusOptions: DEFAULT_STATUS_OPTIONS,
      intermediateGroups: DEFAULT_INTERMEDIATE_GROUPS,
      joinedCollegeOptions: DEFAULT_JOINED_COLLEGE_OPTIONS,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Commit all at once (atomic)
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Setup API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
