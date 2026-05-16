#!/usr/bin/env node
/**
 * Samhitha Admissions Tracker — Reset & Seed Script
 *
 * 1. Calls criticalApi:resetTenantData to wipe all existing tenant data
 * 2. Creates 22 areas via Firestore REST (admin write allowed)
 * 3. Creates 2 leads per area (44 total) via criticalApi:createLead
 * 4. Creates 2 teams (3 areas each) via criticalApi:manageTeam
 *
 * Usage:  node scripts/reset-and-seed.js
 */

const API_KEY    = 'AIzaSyCNOdmucv2HATHD7Ir7-K18fCIwIpzQaeQ';
const PROJECT_ID = 'samhitaadmissiontracker';
const TENANT_ID  = 'samhitha-college';
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_URL   = 'https://identitytoolkit.googleapis.com/v1/accounts';
const CF_URL     = 'https://asia-south1-samhitaadmissiontracker.cloudfunctions.net';

// ─── 22 Target Areas ──────────────────────────────────────────────────────────
const AREAS = [
  { name: 'RAJANAGARAM',   code: 'RJN' },
  { name: 'RANGAMPETA',    code: 'RGP' },
  { name: 'L-DIVISION-2',  code: 'LD2' },
  { name: 'GOKAVARAM',     code: 'GKV' },
  { name: 'KORUKONDA',     code: 'KRK' },
  { name: 'L-DIVISION-4',  code: 'LD4' },
  { name: 'L-DIVISION-1',  code: 'LD1' },
  { name: 'SEETHANAGARAM', code: 'STN' },
  { name: 'MADHURAPUDI',   code: 'MDP' },
  { name: 'THORREDU',      code: 'THR' },
  { name: 'KOVVUR',        code: 'KVR' },
  { name: 'L-DIVISION-3',  code: 'LD3' },
  { name: 'ATREYAPURAM',   code: 'ATP' },
  { name: 'RAVULAPALEM',   code: 'RVP' },
  { name: 'ANAPARTHI',     code: 'ANP' },
  { name: 'KADIYAM',       code: 'KDY' },
  { name: 'ALAMURU',       code: 'ALM' },
  { name: 'CHAGALLU',      code: 'CGU' },
  { name: 'NIDADAVOLE',    code: 'NDD' },
  { name: 'POLAVARAM',     code: 'PLV' },
  { name: 'THALLAPUDI',    code: 'THP' },
  { name: 'DEVARAPALLI',   code: 'DVP' },
];

// 44 sample names (2 per area)
const NAMES = [
  { parent: 'Ramesh Kumar',    student: 'Sai Kumar',       grp: 'MPC'  },
  { parent: 'Lakshmi Devi',    student: 'Priya Sharma',    grp: 'BIPC' },
  { parent: 'Venkat Rao',      student: 'Arjun Reddy',     grp: 'CEC'  },
  { parent: 'Padma Kumari',    student: 'Lavanya Sri',     grp: 'MEC'  },
  { parent: 'Suresh Babu',     student: 'Nithin Kumar',    grp: 'MPC'  },
  { parent: 'Annapurna Devi',  student: 'Kavya Raj',       grp: 'BIPC' },
  { parent: 'Krishna Murthy',  student: 'Ravi Teja',       grp: 'CEC'  },
  { parent: 'Sarala Devi',     student: 'Deepika Reddy',   grp: 'MEC'  },
  { parent: 'Nagaraju',        student: 'Pavan Kalyan',    grp: 'MPC'  },
  { parent: 'Mahalakshmi',     student: 'Sneha Priya',     grp: 'BIPC' },
  { parent: 'Satyanarayana',   student: 'Varun Sai',       grp: 'CEC'  },
  { parent: 'Bhavani Devi',    student: 'Anusha Reddy',    grp: 'MEC'  },
  { parent: 'Raju Garu',       student: 'Karthik Raj',     grp: 'MPC'  },
  { parent: 'Seetha Devi',     student: 'Sravani Kumari',  grp: 'BIPC' },
  { parent: 'Madhusudhan',     student: 'Tejaswi Reddy',   grp: 'CEC'  },
  { parent: 'Kumar Swamy',     student: 'Aditya Sharma',   grp: 'MEC'  },
  { parent: 'Gangamma Devi',   student: 'Swathi Raj',      grp: 'MPC'  },
  { parent: 'Ranganath Rao',   student: 'Rohith Kumar',    grp: 'BIPC' },
  { parent: 'Jayamma',         student: 'Meena Kumari',    grp: 'CEC'  },
  { parent: 'Subbarao',        student: 'Vamsi Krishna',   grp: 'MEC'  },
  { parent: 'Nagaratnam',      student: 'Divya Sri',       grp: 'MPC'  },
  { parent: 'Appala Raju',     student: 'Surya Teja',      grp: 'BIPC' },
  { parent: 'Sujatha Devi',    student: 'Rachana Reddy',   grp: 'CEC'  },
  { parent: 'Murali Krishna',  student: 'Tejas Kumar',     grp: 'MEC'  },
  { parent: 'Vijaya Lakshmi',  student: 'Nithya Sri',      grp: 'MPC'  },
  { parent: 'Bhaskar Rao',     student: 'Hrithik Reddy',   grp: 'BIPC' },
  { parent: 'Tulasi Devi',     student: 'Pooja Reddy',     grp: 'CEC'  },
  { parent: 'Chandrasekhar',   student: 'Akhil Kumar',     grp: 'MEC'  },
  { parent: 'Ratna Kumari',    student: 'Manasa Sri',      grp: 'MPC'  },
  { parent: 'Mohan Rao',       student: 'Vikram Reddy',    grp: 'BIPC' },
  { parent: 'Nagamani Devi',   student: 'Geetha Sri',      grp: 'CEC'  },
  { parent: 'Srinu Babu',      student: 'Lokesh Reddy',    grp: 'MEC'  },
  { parent: 'Pushpa Rani',     student: 'Harini Devi',     grp: 'MPC'  },
  { parent: 'Anand Kumar',     student: 'Santhosh Raj',    grp: 'BIPC' },
  { parent: 'Vani Devi',       student: 'Mounika Sri',     grp: 'CEC'  },
  { parent: 'Ranga Rao',       student: 'Tarun Kumar',     grp: 'MEC'  },
  { parent: 'Sarada Devi',     student: 'Swetha Reddy',    grp: 'MPC'  },
  { parent: 'Prasad Rao',      student: 'Gowtham Raj',     grp: 'BIPC' },
  { parent: 'Nirmala Devi',    student: 'Asha Reddy',      grp: 'CEC'  },
  { parent: 'Subramanyam',     student: 'Hemanth Kumar',   grp: 'MEC'  },
  { parent: 'Radha Devi',      student: 'Yamini Sri',      grp: 'MPC'  },
  { parent: 'Tirupathi Rao',   student: 'Nikhil Reddy',    grp: 'BIPC' },
  { parent: 'Kamala Devi',     student: 'Naveen Kumar',    grp: 'CEC'  },
  { parent: 'Govind Rao',      student: 'Aravind Reddy',   grp: 'MEC'  },
];

// ─── Auth helpers ─────────────────────────────────────────────────────────────

let authToken = null;

async function signIn(email, password) {
  console.log(`[AUTH] Signing in as ${email}...`);
  const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Sign-in failed: ${err.error?.message}`);
  }
  const data = await res.json();
  authToken = data.idToken;
  console.log(`[AUTH] OK — UID: ${data.localId}`);
  return data;
}

// ─── Cloud Function caller ────────────────────────────────────────────────────

async function callCriticalApi(action, payload) {
  const res = await fetch(`${CF_URL}/criticalApi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ data: { action, payload } }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(`criticalApi:${action} => ${body.error.message}`);
  }
  return body.result;
}

// ─── Firestore REST helpers (divisions are admin-writable) ───────────────────

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const out = {};
  for (const [k, val] of Object.entries(obj)) out[k] = toValue(val);
  return out;
}

function fromFields(fields) {
  if (!fields) return {};
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.nullValue !== undefined) out[k] = null;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.integerValue !== undefined) out[k] = parseInt(v.integerValue);
    else if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.arrayValue) out[k] = (v.arrayValue.values || []).map(v2 => v2.stringValue ?? v2);
    else if (v.mapValue) out[k] = fromFields(v.mapValue.fields);
    else out[k] = v;
  }
  return out;
}

async function fsList(collPath) {
  const res = await fetch(`${BASE_URL}/${collPath}?pageSize=300`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents || []).map(d => ({ id: d.name.split('/').pop(), ...fromFields(d.fields) }));
}

async function fsWrite(path, data) {
  const docId = path.split('/').pop();
  const parentPath = path.split('/').slice(0, -1).join('/');
  const res = await fetch(`${BASE_URL}/${parentPath}?documentId=${docId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Write ${path} failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return (await res.json()).name.split('/').pop();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Samhitha — Reset & Seed Script');
  console.log('═══════════════════════════════════════════════════════════\n');

  const authData = await signIn('admin@samhitha.edu', 'Admin@123');
  const adminUid = authData.localId;
  const now = new Date().toISOString();

  // ── 1. RESET ALL DATA ────────────────────────────────────────────────────
  console.log('\n[PHASE 1] Resetting all tenant data...');
  try {
    const result = await callCriticalApi('resetTenantData', { confirm: 'DELETE_ALL_DATA' });
    console.log(`[PHASE 1] Deleted: leads=${result.deleted.leads}, teams=${result.deleted.teams}, areas=${result.deleted.divisions}, reminders=${result.deleted.reminders}`);
  } catch (e) {
    console.error(`[PHASE 1] Reset failed: ${e.message}`);
    console.log('[PHASE 1] Continuing (new data will be added alongside existing)...');
  }

  // ── 2. CREATE/LOAD PRO USERS ─────────────────────────────────────────────
  console.log('\n[PHASE 2] Creating test PRO users...');

  const TEST_PROS = [
    { email: 'pro1@samhitha.edu', username: 'pro_rajesh',  password: 'Pro@123456', displayName: 'Rajesh Kumar',  phone: '9876543210' },
    { email: 'pro2@samhitha.edu', username: 'pro_anitha',  password: 'Pro@123456', displayName: 'Anitha Devi',   phone: '9876543211' },
  ];

  const proUids = [];

  for (const pro of TEST_PROS) {
    // Step 1: Try fresh creation via CF
    try {
      const result = await callCriticalApi('createUser', {
        email:       pro.email,
        username:    pro.username,
        password:    pro.password,
        displayName: pro.displayName,
        phone:       pro.phone,
        role:        'PRO',
      });
      proUids.push(result.uid);
      console.log(`  [CREATE] ${pro.displayName} → uid: ${result.uid}`);
      await sleep(500);
      continue;
    } catch (e) {
      // If auth email already exists, sign in as that user to recover their UID
      if (!e.message.includes('already in use') && !e.message.includes('already-exists') && !e.message.includes('exists')) {
        console.error(`  [ERR] ${pro.email}: ${e.message}`);
        continue;
      }
    }

    // Step 2: Email exists in Auth — sign in as that user to get UID
    console.log(`  [RECOVER] ${pro.email} already exists in Auth — signing in to get UID...`);
    try {
      const proAuthRes = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pro.email, password: pro.password, returnSecureToken: true }),
      });
      const proAuthData = await proAuthRes.json();
      if (!proAuthRes.ok || !proAuthData.localId) {
        throw new Error(proAuthData.error?.message || 'Sign-in failed');
      }
      const proUid = proAuthData.localId;
      const proToken = proAuthData.idToken;

      // Step 3: Check if Firestore user doc exists (using admin token)
      const docRes = await fetch(`${BASE_URL}/users/${proUid}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (docRes.ok) {
        // Doc exists — just ensure it has the right role/tenantId
        const docData = await docRes.json();
        const fields = fromFields(docData.fields || {});
        if (fields.role === 'PRO' && fields.tenantId === TENANT_ID) {
          proUids.push(proUid);
          console.log(`  [EXISTS] ${pro.displayName} (uid: ${proUid}) — Firestore doc OK`);
        } else {
          console.error(`  [ERR] ${pro.email} exists but wrong role/tenant: role=${fields.role} tenant=${fields.tenantId}`);
        }
      } else {
        // Doc doesn't exist — create it signed in AS the PRO user
        const createRes = await fetch(`${BASE_URL}/users?documentId=${proUid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proToken}` },
          body: JSON.stringify({
            fields: toFields({
              email: pro.email,
              username: pro.username,
              displayName: pro.displayName,
              role: 'PRO',
              tenantId: TENANT_ID,
              phone: pro.phone,
              teamId: null,
              assignedDivisionIds: [],
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              fcmDevices: [],
              lastActive: null,
            }),
          }),
        });

        // Also set custom claims by calling syncClaims CF (admin re-signs in first)
        if (createRes.ok) {
          proUids.push(proUid);
          console.log(`  [CREATED-DOC] ${pro.displayName} (uid: ${proUid}) — Firestore doc created`);
          // Sync claims: call syncClaims WITH the PRO's own token so it sets claims for that UID
          try {
            const syncRes = await fetch(`${CF_URL}/criticalApi`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${proToken}` },
              body: JSON.stringify({ data: { action: 'syncClaims', payload: {} } }),
            });
            const syncBody = await syncRes.json();
            if (syncBody.error) throw new Error(syncBody.error.message);
            console.log(`  [CLAIMS] Claims synced for ${pro.displayName}`);
          } catch (claimErr) {
            console.warn(`  [WARN] Claims sync failed (${claimErr.message}) — PRO should re-login to get claims`);
          }
        } else {
          const errBody = await createRes.text();
          console.error(`  [ERR] Could not create Firestore doc for ${pro.email}: ${errBody.slice(0, 200)}`);
        }
      }
    } catch (e2) {
      console.error(`  [ERR] Recovery for ${pro.email} failed: ${e2.message}`);
    }
    await sleep(500);
  }

  console.log(`[PHASE 2] PRO users ready: ${proUids.length} (UIDs: ${proUids.join(', ')})\n`);

  // ── 3. CREATE 22 AREAS ───────────────────────────────────────────────────
  console.log('\n[PHASE 3] Creating 22 areas...');
  const divisionIds = [];
  for (const area of AREAS) {
    const uid = `${TENANT_ID}_${area.code.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    await fsWrite(`divisions/${uid}`, {
      tenantId: TENANT_ID,
      name: area.name,
      code: area.code,
      description: `${area.name} division`,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdByUid: adminUid,
    });
    divisionIds.push({ id: uid, ...area });
    console.log(`  [OK] ${area.name}`);
    await sleep(80);
  }
  console.log(`[PHASE 3] Done — ${divisionIds.length} areas.\n`);

  // ── 4. CREATE 44 LEADS via criticalApi:createLead ───────────────────────
  console.log('[PHASE 4] Creating 44 leads (2 per area)...');
  let nameIdx = 0;
  let seq = 1;
  const allLeads = [];

  for (const div of divisionIds) {
    for (let n = 0; n < 2; n++) {
      const person = NAMES[nameIdx % NAMES.length];
      nameIdx++;
      const seqStr = String(seq).padStart(3, '0');
      const leadPayload = {
        uniqueLeadId:      seq,
        parentName:        person.parent,
        studentName:       person.student,
        parentPhone:       `9${String(seq * 3 + 700000000)}`.slice(0, 10),
        studentPhone:      `8${String(seq * 7 + 600000000)}`.slice(0, 10),
        intermediateGroup: person.grp,
        address:           `${div.name} Main Road`,
        divisionId:        div.id,
      };
      try {
        const result = await callCriticalApi('createLead', leadPayload);
        allLeads.push({ id: result.leadId, divisionId: div.id, divisionName: div.name });
        seq++;
      } catch (e) {
        console.error(`  [ERR] Lead ${leadPayload.uniqueLeadId}: ${e.message}`);
      }
      await sleep(150);
    }
    console.log(`  [OK] ${div.name}: 2 leads`);
  }
  console.log(`[PHASE 4] Done — ${allLeads.length} leads.\n`);

  // ── 5. CREATE 2 TEAMS via criticalApi:manageTeam ─────────────────────────
  console.log('[PHASE 5] Creating teams...');

  const team1Areas = divisionIds.slice(0, 3).map(d => d.id);
  const team2Areas = divisionIds.slice(3, 6).map(d => d.id);

  if (proUids.length === 0) {
    console.log('  [SKIP] No PRO users available — skipping team creation.');
  } else {
    try {
      const r = await callCriticalApi('manageTeam', {
        subAction: 'create',
        name: 'Team Alpha',
        memberUids: [proUids[0]],
        divisionIds: team1Areas,
      });
      console.log(`  [OK] Team Alpha (${r?.teamId}): ${divisionIds.slice(0,3).map(d=>d.name).join(', ')} → PRO: Rajesh Kumar`);
    } catch (e) {
      console.error(`  [ERR] Team Alpha: ${e.message}`);
    }

    await sleep(500);

    if (proUids.length >= 2) {
      try {
        const r = await callCriticalApi('manageTeam', {
          subAction: 'create',
          name: 'Team Beta',
          memberUids: [proUids[1]],
          divisionIds: team2Areas,
        });
        console.log(`  [OK] Team Beta (${r?.teamId}): ${divisionIds.slice(3,6).map(d=>d.name).join(', ')} → PRO: Anitha Devi`);
      } catch (e) {
        console.error(`  [ERR] Team Beta: ${e.message}`);
      }
    }
  }
  console.log('[PHASE 5] Done.\n');

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Areas created  : ${divisionIds.length}`);
  console.log(`  Leads created  : ${allLeads.length}`);
  console.log(`  PRO users      : ${proUids.length} (pro1@samhitha.edu / pro2@samhitha.edu)`);
  console.log(`  Team Alpha     : ${divisionIds.slice(0,3).map(d=>d.name).join(' | ')} → Rajesh Kumar`);
  console.log(`  Team Beta      : ${divisionIds.slice(3,6).map(d=>d.name).join(' | ')} → Anitha Devi`);
  console.log('  PRO password   : Pro@123456');
  console.log('  Remaining 16 areas unassigned — assign via Admin panel.');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
