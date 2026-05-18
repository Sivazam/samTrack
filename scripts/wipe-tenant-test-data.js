/**
 * wipe-tenant-test-data.js
 *
 * Hard-deletes ALL leads, leadAssignments, reminders, and statusUpdates
 * (subcollection under each lead) for a single tenant. Use this to start a
 * clean end-to-end flow test.
 *
 * Does NOT touch: users, teams, divisions, tenantConfig, tenant doc,
 * notifications, audit logs.
 *
 * Usage:
 *   node scripts/wipe-tenant-test-data.js <tenantId> --yes
 * Example:
 *   node scripts/wipe-tenant-test-data.js samhitha-college --yes
 *
 * Requires ../service-account.json at repo root.
 */

const admin = require('firebase-admin');
const path = require('path');

const tenantId = process.argv[2];
const confirmed = process.argv.includes('--yes');

if (!tenantId) {
  console.error('Usage: node scripts/wipe-tenant-test-data.js <tenantId> --yes');
  process.exit(1);
}
if (!confirmed) {
  console.error(`Refusing to delete without --yes flag. Will wipe leads/reminders/assignments for tenant "${tenantId}".`);
  process.exit(1);
}

try {
  const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  console.error('Failed to load service-account.json at repo root:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function deleteQueryBatch(query, label) {
  let total = 0;
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    process.stdout.write(`\r  ${label}: deleted ${total}`);
  }
  process.stdout.write('\n');
  return total;
}

async function deleteSubcollections(parentDocs, subName) {
  let total = 0;
  for (const doc of parentDocs) {
    while (true) {
      const subSnap = await doc.ref.collection(subName).limit(400).get();
      if (subSnap.empty) break;
      const batch = db.batch();
      subSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += subSnap.size;
    }
  }
  console.log(`  ${subName} (under leads): deleted ${total}`);
  return total;
}

(async () => {
  console.log(`\nWiping test data for tenant: ${tenantId}\n`);

  // 1. Collect leads first so we can wipe their statusUpdates subcollection
  const leadsSnap = await db.collection('leads').where('tenantId', '==', tenantId).get();
  console.log(`Found ${leadsSnap.size} leads.`);

  // 2. Wipe statusUpdates subcollection for each lead
  if (!leadsSnap.empty) {
    await deleteSubcollections(leadsSnap.docs, 'statusUpdates');
  }

  // 3. Wipe leads
  await deleteQueryBatch(db.collection('leads').where('tenantId', '==', tenantId), 'leads');

  // 4. Wipe leadAssignments
  await deleteQueryBatch(db.collection('leadAssignments').where('tenantId', '==', tenantId), 'leadAssignments');

  // 5. Wipe reminders
  await deleteQueryBatch(db.collection('reminders').where('tenantId', '==', tenantId), 'reminders');

  // 6. Wipe referrals (if collection exists)
  try {
    await deleteQueryBatch(db.collection('referrals').where('tenantId', '==', tenantId), 'referrals');
  } catch (_) {}

  console.log('\nDone. Tenant config, users, teams, and divisions were left intact.\n');
  process.exit(0);
})().catch(e => {
  console.error('Wipe failed:', e);
  process.exit(1);
});
