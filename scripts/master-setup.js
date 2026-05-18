/**
 * master-setup.js
 *
 * One-shot reset + real PRO staff setup for Samhitha College.
 * 
 * What it does (in order):
 *  1. Wipe all leads, leadAssignments, reminders, statusUpdates for samhitha-college
 *  2. Delete old test PRO Auth accounts and Firestore user docs
 *  3. Hard-delete old teams
 *  4. Create 18 real PRO accounts (Auth + Firestore + usernameIndex)
 *  5. Create 9 teams (pairs), each assigned to 2–4 area divisions
 *
 * Requires gcloud Application Default Credentials:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "$env:APPDATA\gcloud\application_default_credentials.json"
 *   OR
 *   set GOOGLE_APPLICATION_CREDENTIALS=path\to\service-account.json
 *
 * Usage:
 *   node scripts/master-setup.js --yes
 */

const admin = require('firebase-admin');

const confirmed = process.argv.includes('--yes');
if (!confirmed) {
  console.error('Add --yes flag to confirm destructive reset.');
  process.exit(1);
}

// ── Init ──────────────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'samhitaadmissiontracker',
});
const db = admin.firestore();
const auth = admin.auth();

const TENANT_ID = 'samhitha-college';
const DEFAULT_PASSWORD = 'Samhitha@2025';

// ── Division IDs (discovered from Firestore) ─────────────────────────────────
const DIV = {
  RAJANAGARAM:   'samhitha-college_rjn_1778898086171_cxr',
  RANGAMPETA:    'samhitha-college_rgp_1778898086469_w7k',
  L_DIV2:        'samhitha-college_ld2_1778898086635_3dw',
  GOKAVARAM:     'samhitha-college_gkv_1778898086786_ka6',
  KORUKONDA:     'samhitha-college_krk_1778898086953_xnr',
  L_DIV4:        'samhitha-college_ld4_1778898087103_9ii',
  L_DIV1:        'samhitha-college_ld1_1778898087251_lvw',
  MADHURAPUDI:   'samhitha-college_mdp_1778898087586_vdr',
  SEETHANAGARAM: 'samhitha-college_stn_1778898087420_6sh',
  THORREDU:      'samhitha-college_thr_1778898087753_8qv',
  KOVVUR:        'samhitha-college_kvr_1778898087920_92h',
  L_DIV3:        'samhitha-college_ld3_1778898088085_543',
  ATREYAPURAM:   'samhitha-college_atp_1778898088253_8n1',
  RAVULAPALEM:   'samhitha-college_rvp_1778898088419_rob',
  ANAPARTHI:     'samhitha-college_anp_1778898088603_e63',
  KADIYAM:       'samhitha-college_kdy_1778898088769_uuc',
  ALAMURU:       'samhitha-college_alm_1778898088935_05a',
  CHAGALLU:      'samhitha-college_cgu_1778898089119_5hn',
  NIDADAVOLE:    'samhitha-college_ndd_1778898089269_ft1',
  POLAVARAM:     'samhitha-college_plv_1778898089436_39n',
  THALLAPUDI:    'samhitha-college_thp_1778898089620_g1o',
  DEVARAPALLI:   'samhitha-college_dvp_1778898089769_zo5',
};

// ── Real PRO Staff ────────────────────────────────────────────────────────────
const PROS = [
  { name: 'G Bala Krishna',     email: 'gbalakrishna@samhithaedu.com',      phone: '9248111010', username: 'gbalakrishna' },
  { name: 'P Suresh',           email: 'psuresh@samhithaedu.com',            phone: '9397910065', username: 'psuresh' },
  { name: 'Y Nageswarao',       email: 'yedidajoshua5@gmail.com',            phone: '7013684505', username: 'ynageswarao' },
  { name: 'K Srinu',            email: 'ksrinu@samhithaedu.com',             phone: '8688885046', username: 'ksrinu' },
  { name: 'D V V Satish',       email: 'dvsatish@samhithaedu.com',           phone: '9676972450', username: 'dvvsatish' },
  { name: 'K V Rajesh',         email: 'kvkumar@samhithaedu.com',            phone: '9885048668', username: 'kvrajesh' },
  { name: 'V Rama Reddy',       email: 'vvreddy@samhithaedu.com',            phone: '9908476074', username: 'vrreddy' },
  { name: 'P Jayaraju',         email: 'pjayaraju@samhithaedu.com',          phone: '9493075788', username: 'pjayaraju' },
  { name: 'T S N Murthy',       email: 'tsn2025000@gmail.com',               phone: '9490716177', username: 'tsnmurthy' },
  { name: 'K Surya Manoj',      email: 'suryamanojkumarkerla@gmail.com',     phone: '9948840263', username: 'ksuryamanoj' },
  { name: 'K B Raja',           email: 'kbraja@samhithaedu.com',             phone: '9676552524', username: 'kbraja' },
  { name: 'A Sivaji',           email: 'asganesh@samhithaedu.com',           phone: '9948857892', username: 'asivaji' },
  { name: 'K Govind',           email: 'kgovindu@samhithaedu.com',           phone: '9989866696', username: 'kgovindu' },
  { name: 'K Veer Raju',        email: 'kveerraju@samhithaedu.com',          phone: '9948776389', username: 'kveerraju' },
  { name: 'B Sukumar',          email: 'bsukumar@samhithaedu.com',           phone: '9989996635', username: 'bsukumar' },
  { name: 'P Satyanarayana',    email: 'pvvsnarayana@samhithaedu.com',       phone: '9963331539', username: 'pvvsnarayana' },
  { name: 'D Anil',             email: 'doddianil909@gmail.com',             phone: '9848514598', username: 'danil' },
  { name: 'A Saikumar',         email: 'saimadhu281@gmail.com',              phone: '8465908582', username: 'asaikumar' },
];

// ── Team Configuration ────────────────────────────────────────────────────────
// Each team = { name, proIndices (0-based into PROS), divisionIds }
const TEAMS_CONFIG = [
  { name: 'Team Rajanagaram',  proIdx: [0, 1],     divs: [DIV.RAJANAGARAM,  DIV.RANGAMPETA] },
  { name: 'Team Gokavaram',    proIdx: [2, 3],     divs: [DIV.GOKAVARAM,    DIV.KORUKONDA] },
  { name: 'Team Kovvur',       proIdx: [4, 5],     divs: [DIV.KOVVUR,       DIV.SEETHANAGARAM] },
  { name: 'Team Madhurapudi',  proIdx: [6, 7],     divs: [DIV.MADHURAPUDI,  DIV.THORREDU] },
  { name: 'Team Alamuru',      proIdx: [8, 9],     divs: [DIV.ALAMURU,      DIV.ANAPARTHI,    DIV.ATREYAPURAM] },
  { name: 'Team Devarapalli',  proIdx: [10, 11],   divs: [DIV.DEVARAPALLI,  DIV.NIDADAVOLE] },
  { name: 'Team Polavaram',    proIdx: [12, 13],   divs: [DIV.POLAVARAM,    DIV.THALLAPUDI] },
  { name: 'Team Chagallu',     proIdx: [14, 15],   divs: [DIV.CHAGALLU,     DIV.KADIYAM,      DIV.RAVULAPALEM] },
  { name: 'Team L-Division',   proIdx: [16, 17],   divs: [DIV.L_DIV1,       DIV.L_DIV2,       DIV.L_DIV3, DIV.L_DIV4] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (total > 0) process.stdout.write('\n');
  return total;
}

async function deleteSubcollections(parentDocs, subName) {
  let total = 0;
  for (const doc of parentDocs) {
    while (true) {
      const sub = await doc.ref.collection(subName).limit(400).get();
      if (sub.empty) break;
      const b = db.batch();
      sub.docs.forEach(d => b.delete(d.ref));
      await b.commit();
      total += sub.size;
    }
  }
  if (total > 0) console.log(`  ${subName} subcollection: deleted ${total}`);
}

// ── Step 1: Wipe lead data ────────────────────────────────────────────────────
async function wipeLeadData() {
  console.log('\n[1/5] Wiping leads, assignments, reminders...');
  const leadsSnap = await db.collection('leads').where('tenantId', '==', TENANT_ID).get();
  if (!leadsSnap.empty) await deleteSubcollections(leadsSnap.docs, 'statusUpdates');
  await deleteQueryBatch(db.collection('leads').where('tenantId', '==', TENANT_ID), 'leads');
  await deleteQueryBatch(db.collection('leadAssignments').where('tenantId', '==', TENANT_ID), 'leadAssignments');
  await deleteQueryBatch(db.collection('reminders').where('tenantId', '==', TENANT_ID), 'reminders');
  try { await deleteQueryBatch(db.collection('referrals').where('tenantId', '==', TENANT_ID), 'referrals'); } catch (_) {}
  console.log('  Done.');
}

// ── Step 2: Delete old test PRO accounts ─────────────────────────────────────
async function deleteOldPROs() {
  console.log('\n[2/5] Deleting old test PRO accounts...');
  const snap = await db.collection('users')
    .where('tenantId', '==', TENANT_ID)
    .where('role', '==', 'PRO')
    .get();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    // Delete Firebase Auth user
    try {
      await auth.deleteUser(doc.id);
      console.log(`  ✓ Deleted Auth: ${data.displayName} (${data.email})`);
    } catch (e) {
      console.log(`  ⚠ Auth delete failed for ${data.email}: ${e.message}`);
    }
    // Delete username index
    if (data.username) {
      try {
        await db.collection('usernameIndex').doc(`${TENANT_ID}__${data.username}`).delete();
      } catch (_) {}
    }
    // Delete user doc
    await doc.ref.delete();
  }
  console.log(`  Removed ${snap.size} old PRO(s).`);
}

// ── Step 3: Delete old teams ──────────────────────────────────────────────────
async function deleteOldTeams() {
  console.log('\n[3/5] Deleting old teams...');
  const snap = await db.collection('teams').where('tenantId', '==', TENANT_ID).get();
  const b = db.batch();
  snap.docs.forEach(d => b.delete(d.ref));
  if (!snap.empty) await b.commit();
  console.log(`  Removed ${snap.size} old team(s).`);
}

// ── Step 4: Create real PRO accounts ─────────────────────────────────────────
async function createPROAccounts() {
  console.log('\n[4/5] Creating 18 real PRO accounts...');
  const now = admin.firestore.Timestamp.now();
  const createdUids = [];

  for (const pro of PROS) {
    try {
      // Check if auth user already exists by email
      let uid;
      try {
        const existing = await auth.getUserByEmail(pro.email);
        // Reset password + ensure claims are set
        await auth.updateUser(existing.uid, { password: DEFAULT_PASSWORD, displayName: pro.name });
        await auth.setCustomUserClaims(existing.uid, { role: 'PRO', tenantId: TENANT_ID });
        uid = existing.uid;
        console.log(`  ↺ Updated existing Auth: ${pro.name} (${pro.email})`);
      } catch (notFound) {
        // Create new
        const record = await auth.createUser({
          email: pro.email,
          password: DEFAULT_PASSWORD,
          displayName: pro.name,
        });
        await auth.setCustomUserClaims(record.uid, { role: 'PRO', tenantId: TENANT_ID });
        uid = record.uid;
        console.log(`  ✓ Created Auth: ${pro.name} (${pro.email}) → ${uid}`);
      }

      // Write/overwrite Firestore user doc
      await db.collection('users').doc(uid).set({
        tenantId: TENANT_ID,
        email: pro.email,
        username: pro.username,
        displayName: pro.name,
        phone: pro.phone,
        role: 'PRO',
        teamId: null,
        assignedDivisionIds: [],
        active: true,
        fcmDevices: [],
        createdAt: now,
        updatedAt: now,
        createdByUid: 'master-setup',
      });

      // Write username index
      await db.collection('usernameIndex').doc(`${TENANT_ID}__${pro.username}`).set({
        uid,
        email: pro.email,
        tenantId: TENANT_ID,
        username: pro.username,
        createdAt: now,
      });

      createdUids.push(uid);
      pro._uid = uid; // Attach for team creation
    } catch (e) {
      console.error(`  ✗ Failed to create ${pro.name}: ${e.message}`);
      createdUids.push(null);
      pro._uid = null;
    }
  }
  console.log(`  Created/updated ${createdUids.filter(Boolean).length} PRO(s).`);
  return createdUids;
}

// ── Step 5: Create teams with division assignments ────────────────────────────
async function createTeams() {
  console.log('\n[5/5] Creating 9 teams with area assignments...');
  const now = admin.firestore.Timestamp.now();

  for (const teamCfg of TEAMS_CONFIG) {
    const memberUids = teamCfg.proIdx.map(i => PROS[i]._uid).filter(Boolean);
    if (memberUids.length === 0) {
      console.log(`  ⚠ Skipping ${teamCfg.name} — no valid member UIDs`);
      continue;
    }

    const teamRef = db.collection('teams').doc();
    await teamRef.set({
      tenantId: TENANT_ID,
      name: teamCfg.name,
      memberUids,
      divisionIds: teamCfg.divs,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdByUid: 'master-setup',
    });

    // Update each PRO's user doc with teamId + assignedDivisionIds
    for (const uid of memberUids) {
      await db.collection('users').doc(uid).update({
        teamId: teamRef.id,
        assignedDivisionIds: teamCfg.divs,
        updatedAt: now,
      });
    }

    const names = teamCfg.proIdx.map(i => PROS[i].name).join(' + ');
    const divNames = Object.keys(DIV).filter(k => teamCfg.divs.includes(DIV[k])).join(', ');
    console.log(`  ✓ ${teamCfg.name} [${names}] → ${divNames}`);
  }
  console.log('  Done.');
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('='.repeat(60));
  console.log(' Samhitha College — Master Setup (DESTRUCTIVE)');
  console.log(' Tenant:', TENANT_ID);
  console.log('='.repeat(60));

  try {
    await wipeLeadData();
    await deleteOldPROs();
    await deleteOldTeams();
    await createPROAccounts();
    await createTeams();

    console.log('\n' + '='.repeat(60));
    console.log(' ✅ Setup complete!');
    console.log('');
    console.log(' Default PRO password: ' + DEFAULT_PASSWORD);
    console.log(' PROs can log in at: https://samhitha-track.vercel.app/login');
    console.log(' (or wherever the app is deployed)');
    console.log('');
    console.log(' Accounts created:');
    PROS.forEach(p => console.log(`   ${p.name.padEnd(22)} ${p.email} (username: ${p.username})`));
    console.log('='.repeat(60));
    process.exit(0);
  } catch (e) {
    console.error('\n✗ Setup failed:', e.message, e.stack);
    process.exit(1);
  }
})();
