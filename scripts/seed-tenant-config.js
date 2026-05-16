/**
 * Seeds default tenant configuration for Samhitha College.
 * Usage: node scripts/seed-tenant-config.js --tenant=<tenantId>
 */
const admin = require('firebase-admin');

// Parse args
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace('--', '').split('=');
  acc[key] = val;
  return acc;
}, {});

const tenantId = args.tenant;
if (!tenantId) {
  console.error('Usage: node scripts/seed-tenant-config.js --tenant=<tenantId>');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const DEFAULT_STATUS_OPTIONS = [
  { code: 'WAITING_EAMCET', label: 'Waiting EAMCET', color: '#3b82f6', isTerminal: false, order: 1, active: true },
  { code: 'WAITING_NEET', label: 'Waiting NEET', color: '#8b5cf6', isTerminal: false, order: 2, active: true },
  { code: 'WAITING_INTER_RESULTS', label: 'Waiting Inter Results', color: '#6366f1', isTerminal: false, order: 3, active: true },
  { code: 'WILLING_DEGREE', label: 'Willing Degree', color: '#22c55e', isTerminal: false, order: 4, active: true },
  { code: 'NOT_INTERESTED_DEGREE', label: 'Not Willing - Degree', color: '#dc2626', isTerminal: true, order: 5, active: true },
  { code: 'WILLING_SAMHITHA', label: 'Willing Samhitha', color: '#10b981', isTerminal: false, order: 6, active: true },
  { code: 'WILLING_OTHER_COLLEGE', label: 'Willing Other College', color: '#f59e0b', isTerminal: false, order: 7, active: true },
  { code: 'JOINED_OTHER', label: 'Joined Other', color: '#f97316', isTerminal: true, order: 8, active: true },
  { code: 'NOT_INTERESTED_SAMHITHA', label: 'Not Willing - Samhitha', color: '#dc2626', isTerminal: true, order: 9, active: true },
  { code: 'NOT_DECIDED', label: 'Not Decided', color: '#6b7280', isTerminal: false, order: 10, active: true },
  { code: 'FEES_HIGH', label: 'Fees High', color: '#eab308', isTerminal: false, order: 11, active: true },
  { code: 'BUS_ROUTE_PROBLEM', label: 'Bus Route Problem', color: '#a855f7', isTerminal: false, order: 12, active: true },
  { code: 'JOINED_SAMHITHA', label: 'Joined Samhitha', color: '#16a34a', isTerminal: true, order: 13, active: true },
  { code: 'PHONE_UNREACHABLE', label: 'Phone Unreachable', color: '#9ca3af', isTerminal: false, order: 14, active: true },
  { code: 'NOT_ANSWERING', label: 'Not Answering', color: '#78716c', isTerminal: false, order: 15, active: true },
  { code: 'WRONG_NUMBER', label: 'Wrong Number', color: '#737373', isTerminal: false, order: 16, active: true },
  { code: 'ADDRESS_INCORRECT', label: 'Address Incorrect', color: '#a3a3a3', isTerminal: false, order: 17, active: true },
  { code: 'REVISIT_NEEDED', label: 'Revisit Needed', color: '#fb923c', isTerminal: false, order: 18, active: true },
  { code: 'TRANSFERRED_CITY', label: 'Transferred City', color: '#0ea5e9', isTerminal: false, order: 19, active: true },
  { code: 'EXAM_FAILED', label: 'Exam Failed', color: '#b91c1c', isTerminal: false, order: 20, active: true },
  { code: 'NOT_SHARING_ADDRESS', label: 'Not Sharing Address', color: '#d97706', isTerminal: false, order: 21, active: true },
  { code: 'IRRELEVANT', label: 'Irrelevant', color: '#525252', isTerminal: true, order: 22, active: true },
  { code: 'LEAD_FROM_HIGHER_MGMT', label: 'Lead From Higher Mgmt', color: '#2563eb', isTerminal: false, order: 23, active: true },
  { code: 'LEAD_GIVEN_TO_TEAM', label: 'Lead Given To Team', color: '#7c3aed', isTerminal: false, order: 24, active: true },
  { code: 'DOORSTEP_NOT_REQUIRED', label: 'Doorstep Not Required', color: '#64748b', isTerminal: false, order: 25, active: true },
];

const DEFAULT_INTERMEDIATE_GROUPS = [
  { code: 'MPC', label: 'MPC', order: 1, active: true },
  { code: 'BIPC', label: 'BiPC', order: 2, active: true },
  { code: 'CEC', label: 'CEC', order: 3, active: true },
  { code: 'HEC', label: 'HEC', order: 4, active: true },
  { code: 'MEC', label: 'MEC', order: 5, active: true },
  { code: 'VOCATIONAL', label: 'Vocational', order: 6, active: true },
  { code: 'NA', label: 'N/A', order: 7, active: true },
  { code: 'OTHERS', label: 'Others', order: 8, active: true },
];

const DEFAULT_JOINED_COLLEGE_OPTIONS = [
  { code: 'SAMHITHA', label: 'Samhitha College', order: 1, active: true },
  { code: 'OTHER_1', label: 'Other College 1', order: 2, active: true },
  { code: 'OTHER_2', label: 'Other College 2', order: 3, active: true },
  { code: 'OTHER_3', label: 'Other College 3', order: 4, active: true },
  { code: 'OTHER_4', label: 'Other College 4', order: 5, active: true },
  { code: 'OTHER_5', label: 'Other College 5', order: 6, active: true },
  { code: 'OTHER_6', label: 'Other College 6', order: 7, active: true },
  { code: 'OTHER_7', label: 'Other College 7', order: 8, active: true },
  { code: 'OTHERS', label: 'Others', order: 9, active: true },
];

async function seed() {
  console.log(`Seeding tenant config for tenant: ${tenantId}`);
  
  await db.collection('tenantConfig').doc(tenantId).set({
    tenantId,
    statusOptions: DEFAULT_STATUS_OPTIONS,
    intermediateGroups: DEFAULT_INTERMEDIATE_GROUPS,
    joinedCollegeOptions: DEFAULT_JOINED_COLLEGE_OPTIONS,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('✅ Tenant config seeded successfully!');
  console.log(`  - ${DEFAULT_STATUS_OPTIONS.length} status options`);
  console.log(`  - ${DEFAULT_INTERMEDIATE_GROUPS.length} intermediate groups`);
  console.log(`  - ${DEFAULT_JOINED_COLLEGE_OPTIONS.length} joined college options`);
}

seed().catch(console.error);
