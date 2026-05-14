/**
 * Creates the initial Samhitha tenant + first SUPER_ADMIN + COLLEGE_ADMIN.
 * Usage: node scripts/seed-initial-tenant.js
 */
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const auth = admin.auth();

const TENANT_NAME = 'Samhitha College';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@samhitha.edu';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const COLLEGE_ADMIN_EMAIL = process.env.COLLEGE_ADMIN_EMAIL || 'admin@samhitha.edu';
const COLLEGE_ADMIN_PASSWORD = process.env.COLLEGE_ADMIN_PASSWORD || 'Admin@123';

async function seed() {
  console.log('Creating initial tenant and users...');
  
  // 1. Create tenant doc
  const tenantRef = db.collection('tenants').doc();
  const tenantId = tenantRef.id;
  const now = admin.firestore.FieldValue.serverTimestamp();

  await tenantRef.set({
    name: TENANT_NAME,
    type: 'COLLEGE',
    status: 'ACTIVE',
    fcmDevices: [],
    createdAt: now,
    updatedAt: now,
  });
  console.log(`✅ Tenant created: ${tenantId} (${TENANT_NAME})`);

  // 2. Create SUPER_ADMIN
  try {
    const saUser = await auth.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      displayName: 'Super Admin',
    });
    await auth.setCustomUserClaims(saUser.uid, { role: 'SUPER_ADMIN' });
    await db.collection('users').doc(saUser.uid).set({
      tenantId,
      email: SUPER_ADMIN_EMAIL,
      username: 'superadmin',
      displayName: 'Super Admin',
      phone: null,
      role: 'SUPER_ADMIN',
      teamId: null,
      assignedDivisionIds: [],
      active: true,
      fcmDevices: [],
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('usernameIndex').doc(`${tenantId}__superadmin`).set({
      uid: saUser.uid, email: SUPER_ADMIN_EMAIL, tenantId, createdAt: now,
    });
    console.log(`✅ SUPER_ADMIN created: ${SUPER_ADMIN_EMAIL}`);
  } catch (e) {
    console.warn(`⚠️ SUPER_ADMIN creation failed (may already exist): ${e.message}`);
  }

  // 3. Create COLLEGE_ADMIN
  try {
    const caUser = await auth.createUser({
      email: COLLEGE_ADMIN_EMAIL,
      password: COLLEGE_ADMIN_PASSWORD,
      displayName: 'College Admin',
    });
    await auth.setCustomUserClaims(caUser.uid, { role: 'COLLEGE_ADMIN', tenantId });
    await db.collection('users').doc(caUser.uid).set({
      tenantId,
      email: COLLEGE_ADMIN_EMAIL,
      username: 'admin',
      displayName: 'College Admin',
      phone: null,
      role: 'COLLEGE_ADMIN',
      teamId: null,
      assignedDivisionIds: [],
      active: true,
      fcmDevices: [],
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('usernameIndex').doc(`${tenantId}__admin`).set({
      uid: caUser.uid, email: COLLEGE_ADMIN_EMAIL, tenantId, createdAt: now,
    });
    console.log(`✅ COLLEGE_ADMIN created: ${COLLEGE_ADMIN_EMAIL}`);
  } catch (e) {
    console.warn(`⚠️ COLLEGE_ADMIN creation failed (may already exist): ${e.message}`);
  }

  // 4. Seed tenant config
  console.log('\nRun: node scripts/seed-tenant-config.js --tenant=' + tenantId);
  console.log('\nTenant ID:', tenantId);
}

seed().catch(console.error);
