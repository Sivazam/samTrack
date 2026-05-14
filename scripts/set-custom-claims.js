/**
 * Sets custom claims for all users in a tenant.
 * Usage: node scripts/set-custom-claims.js --tenant=<tenantId>
 */
const admin = require('firebase-admin');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace('--', '').split('=');
  acc[key] = val;
  return acc;
}, {});

const tenantId = args.tenant;

if (!admin.apps.length) {
  const serviceAccount = require('../service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const auth = admin.auth();

async function setClaims() {
  console.log(`Setting custom claims for tenant: ${tenantId || 'ALL'}`);

  let query = db.collection('users');
  if (tenantId) query = query.where('tenantId', '==', tenantId);

  const snap = await query.get();
  console.log(`Found ${snap.size} users`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const uid = doc.id;
    const customClaims = {
      role: data.role,
      tenantId: data.tenantId,
    };
    if (data.teamId) customClaims.teamId = data.teamId;

    try {
      await auth.setCustomUserClaims(uid, customClaims);
      console.log(`  ✅ ${data.email} → ${data.role} (${data.tenantId})`);
    } catch (e) {
      console.error(`  ❌ ${data.email}: ${e.message}`);
    }
  }

  console.log('Done!');
}

setClaims().catch(console.error);
