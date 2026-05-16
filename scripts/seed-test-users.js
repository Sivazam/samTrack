/**
 * Creates test users for Samhitha College: 1 Admin, 1 Manager, 3 PROs.
 *
 * PREREQUISITE:
 *   1. Download service account key from Firebase Console:
 *      → Project Settings → Service Accounts → Generate New Private Key
 *   2. Save it as: service-account.json  (in the project root, same dir as package.json)
 *
 * USAGE:
 *   node scripts/seed-test-users.js
 *
 *   To override tenant ID (auto-detected by default):
 *   node scripts/seed-test-users.js --tenant=samhitha-college
 */

const admin = require('firebase-admin');

// ─── Parse CLI args ─────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace('--', '').split('=');
  acc[key] = val;
  return acc;
}, {});

// ─── Initialize Firebase Admin SDK ──────────────────────────────
let serviceAccount;
try {
  serviceAccount = require('../service-account.json');
} catch (e) {
  console.error('❌ service-account.json not found in project root!');
  console.error('   Download it from Firebase Console → Project Settings → Service Accounts');
  console.error('   Save as: service-account.json (next to package.json)');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const auth = admin.auth();

// ─── Test Users to Create ──────────────────────────────────────
const TEST_USERS = [
  // ── COLLEGE ADMIN ──
  {
    username: 'testadmin',
    displayName: 'Test Admin',
    email: 'testadmin@samhitha.edu',
    password: 'TestAdmin@123',
    role: 'COLLEGE_ADMIN',
    phone: '9876543210',
  },
  // ── MANAGER ──
  {
    username: 'testmanager',
    displayName: 'Test Manager',
    email: 'testmanager@samhitha.edu',
    password: 'TestManager@123',
    role: 'MANAGER',
    phone: '9876543211',
  },
  // ── PRO 1 ──
  {
    username: 'testpro1',
    displayName: 'Test PRO One',
    email: 'testpro1@samhitha.edu',
    password: 'TestPro1@123',
    role: 'PRO',
    phone: '9876543212',
  },
  // ── PRO 2 ──
  {
    username: 'testpro2',
    displayName: 'Test PRO Two',
    email: 'testpro2@samhitha.edu',
    password: 'TestPro2@123',
    role: 'PRO',
    phone: '9876543213',
  },
  // ── PRO 3 ──
  {
    username: 'testpro3',
    displayName: 'Test PRO Three',
    email: 'testpro3@samhitha.edu',
    password: 'TestPro3@123',
    role: 'PRO',
    phone: '9876543214',
  },
];

// ─── Main ───────────────────────────────────────────────────────
async function seed() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Samhitha College — Test User Seeding Script   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Find or use tenant ID
  let tenantId = args.tenant;

  if (!tenantId) {
    console.log('🔍 Auto-detecting Samhitha College tenant...');
    const tenantsSnap = await db.collection('tenants')
      .where('name', '>=', 'Samhitha')
      .where('name', '<=', 'Samhitha\ufffd')
      .get();

    if (tenantsSnap.empty) {
      // Try another pattern
      const allTenants = await db.collection('tenants').get();
      if (allTenants.empty) {
        console.error('❌ No tenants found in Firestore. Create Samhitha College first.');
        process.exit(1);
      }
      console.log('   Available tenants:');
      allTenants.docs.forEach(d => console.log(`     • ${d.id} → ${d.data().name}`));
      console.error('\n❌ Could not auto-detect tenant. Use --tenant=<id>');
      process.exit(1);
    }

    // Find the exact match
    const samhitha = tenantsSnap.docs.find(d =>
      d.data().name.toLowerCase().includes('samhitha')
    );

    if (samhitha) {
      tenantId = samhitha.id;
      console.log(`   ✅ Found: ${tenantId} → ${samhitha.data().name}`);
    } else {
      console.log('   Closest matches:');
      tenantsSnap.docs.forEach(d => console.log(`     • ${d.id} → ${d.data().name}`));
      console.error('\n❌ Could not auto-detect tenant. Use --tenant=<id>');
      process.exit(1);
    }
  } else {
    // Verify the specified tenant exists
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.error(`❌ Tenant "${tenantId}" not found!`);
      process.exit(1);
    }
    console.log(`🔍 Using specified tenant: ${tenantId} → ${tenantDoc.data().name}`);
  }

  console.log(`\n📋 Creating ${TEST_USERS.length} test users for tenant: ${tenantId}\n`);

  const results = { created: [], skipped: [], failed: [] };
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 2. Create each user
  for (const user of TEST_USERS) {
    const usernameLower = user.username.toLowerCase();
    const indexDocId = `${tenantId}__${usernameLower}`;

    try {
      // Check username uniqueness
      const existingIndex = await db.collection('usernameIndex').doc(indexDocId).get();
      if (existingIndex.exists) {
        console.log(`   ⏭️  SKIPPED: @${user.username} (${user.email}) — username already taken`);
        results.skipped.push(user);
        continue;
      }

      // Check if auth user already exists
      try {
        await auth.getUserByEmail(user.email);
        console.log(`   ⏭️  SKIPPED: ${user.email} — auth user already exists`);
        results.skipped.push(user);
        continue;
      } catch (e) {
        // getUserByEmail throws if not found — that's expected
      }

      // Create Auth user
      const userRecord = await auth.createUser({
        email: user.email,
        password: user.password,
        displayName: user.displayName,
      });

      // Set custom claims
      const customClaims = { role: user.role, tenantId };
      await auth.setCustomUserClaims(userRecord.uid, customClaims);

      // Write Firestore docs in a transaction
      await db.runTransaction(async (tx) => {
        // User doc
        tx.set(db.collection('users').doc(userRecord.uid), {
          tenantId,
          email: user.email,
          username: usernameLower,
          displayName: user.displayName,
          phone: user.phone || null,
          role: user.role,
          teamId: null,
          assignedDivisionIds: [],
          active: true,
          fcmDevices: [],
          createdAt: now,
          updatedAt: now,
          createdByUid: 'seed-script',
        });

        // Username index
        tx.set(db.collection('usernameIndex').doc(indexDocId), {
          uid: userRecord.uid,
          email: user.email,
          tenantId,
          username: usernameLower,
          createdAt: now,
        });
      });

      const roleIcon = { COLLEGE_ADMIN: '🏢', MANAGER: '📋', PRO: '🚶' }[user.role] || '👤';
      console.log(`   ✅ ${roleIcon} @${user.username.padEnd(14)} ${user.role.padEnd(14)} ${user.email.padEnd(30)} → uid: ${userRecord.uid}`);
      results.created.push({ ...user, uid: userRecord.uid });

    } catch (e) {
      console.error(`   ❌ FAILED: @${user.username} (${user.email}) — ${e.message}`);
      results.failed.push({ ...user, error: e.message });
    }
  }

  // 3. Summary
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                  SUMMARY                         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Created : ${String(results.created.length).padEnd(4)} users                           ║`);
  console.log(`║  Skipped : ${String(results.skipped.length).padEnd(4)} users (already exist)            ║`);
  console.log(`║  Failed  : ${String(results.failed.length).padEnd(4)} users                            ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (results.created.length > 0) {
    console.log('═══════════════════════════════════════════════════');
    console.log('  🔐 CREDENTIALS FOR CREATED USERS');
    console.log('═══════════════════════════════════════════════════\n');
    for (const u of results.created) {
      console.log(`  📧 ${u.email}`);
      console.log(`  🔑 Password : ${u.password}`);
      console.log(`  👤 Username : @${u.username}`);
      console.log(`  🏷️  Role     : ${u.role}`);
      console.log(`  📱 Phone    : ${u.phone}`);
      console.log(`  🆔 UID      : ${u.uid}`);
      console.log('  ───────────────────────────────────────');
    }
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('═══════════════════════════════════════════════════');
    console.log('  ❌ FAILED USERS');
    console.log('═══════════════════════════════════════════════════\n');
    for (const u of results.failed) {
      console.log(`  ❌ ${u.email} → ${u.error}`);
    }
    console.log('');
  }

  console.log('✨ Done! You can now log in with these credentials.');
}

seed().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
