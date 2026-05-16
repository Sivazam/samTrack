#!/usr/bin/env bun
/**
 * Samhitha Admissions Tracker — Comprehensive Seed Data Script
 * 
 * Uses Firebase Auth REST API (NO service account key).
 * Signs in as admin@samhitha.edu / Admin@123, then seeds:
 *   - 4 Divisions
 *   - 4 Teams (each with 1-2 PRO members)
 *   - 20+ Leads
 *   - 30+ Status Updates
 *   - 10+ Reminders
 *
 * Usage:
 *   bun run scripts/seed-all-data.js
 */

const API_KEY = 'AIzaSyCNOdmucv2HATHD7Ir7-K18fCIwIpzQaeQ';
const PROJECT_ID = 'samhitaadmissiontracker';
const TENANT_ID = 'samhitha-college';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`;

// ─── Utility helpers ────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function signIn(email, password) {
  console.log(`[AUTH] Signing in as ${email}...`);
  const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Sign-in failed: ${err.error?.message || res.statusText}`);
  }
  const data = await res.json();
  console.log(`[AUTH] Signed in successfully. UID: ${data.localId}`);
  return data.idToken;
}

async function refreshIdToken(refreshToken) {
  const res = await fetch(`${AUTH_URL}:token?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.statusText}`);
  const data = await res.json();
  return { idToken: data.id_token, refreshToken: data.refresh_token };
}

// Firestore REST helpers
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

let authToken;
let refreshTokenVal;

async function writeDoc(path, data) {
  const res = await fetch(`${BASE_URL}/${path}?documentId=${path.split('/').pop()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Write ${path} failed (${res.status}): ${err}`);
  }
  console.log(`[DB] Wrote ${path}`);
}

async function addDoc(collectionPath, data) {
  const docId = `${collectionPath.replace(/\//g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const path = `${collectionPath}/${docId}`;
  await writeDoc(path, data);
  return docId;
}

async function queryCollection(collectionPath) {
  const res = await fetch(`${BASE_URL}/${collectionPath}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error(`Query ${collectionPath} failed: ${res.status}`);
  const data = await res.json();
  return (data.documents || []).map(d => ({
    id: d.name.split('/').pop(),
    ...fromFields(d.fields),
  }));
}

function fromFields(fields) {
  if (!fields) return {};
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.nullValue !== undefined) out[k] = null;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.integerValue !== undefined) out[k] = parseInt(v.integerValue);
    else if (v.doubleValue !== undefined) out[k] = v.doubleValue;
    else if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.timestampValue !== undefined) out[k] = new Date(v.timestampValue);
    else if (v.arrayValue) out[k] = v.arrayValue.values.map(v2 => fromFields(v2));
    else if (v.mapValue) out[k] = fromFields(v.mapValue.fields);
    else if (v.referenceValue) out[k] = v.referenceValue;
    else out[k] = v;
  }
  return out;
}

const now = new Date();
const isoNow = now.toISOString();

// ─── Seed Data Definitions ────────────────────────────────────────────────────────

const DIVISIONS = [
  { code: 'RJY', name: 'Rajamahendravaram', description: 'East Godavari district headquarters' },
  { code: 'VJA', name: 'Vijayawada', description: 'Krishna district, capital region' },
  { code: 'KAK', name: 'Kakinada', description: 'Coastal Andhra, East Godavari' },
  { code: 'TPT', name: 'Tirupati', description: 'Chittoor district, temple city' },
];

const STATUSES = [
  'WAITING_EAMCET', 'WILLING_SAMHITHA', 'JOINED_SAMHITHA', 'NOT_INTERESTED_SAMHITHA',
  'NOT_DECIDED', 'WAITING_NEET', 'WILLING_OTHER_COLLEGE', 'JOINED_OTHER',
  'REVISIT_NEEDED', 'PHONE_UNREACHABLE',
];

const APPROACHES = ['PHONE', 'DOORSTEP', 'WALK_IN', 'ONLINE'];

const COMMENTS_POOL = [
  'Parent interested, needs campus visit',
  'Student scored 85% in inter, good candidate',
  'Follow up after EAMCET results',
  'Visited college, liked the campus',
  'Not responding to calls, will try again tomorrow',
  'Parent wants to compare with other colleges',
  'Student interested in CSE branch',
  'Fee structure discussed, affordable range',
  'Called twice, no response yet',
  'Student already joined another college',
  'Very interested, scheduling campus tour',
  'Parent wants scholarship information',
  'Discussed placement records, impressed',
  'Will decide after counselling',
];

const NAMES = [
  { parent: 'Ramesh Kumar', student: 'Sai Kumar' },
  { parent: 'Lakshmi Devi', student: 'Priya Sharma' },
  { parent: 'Venkat Rao', student: 'Arjun Reddy' },
  { parent: 'Padma Kumari', student: 'Lavanya Sri' },
  { parent: 'Suresh Babu', student: 'Nithin Kumar' },
  { parent: 'Annapurna', student: 'Kavya Raj' },
  { parent: 'Krishna Murthy', student: 'Ravi Teja' },
  { parent: 'Sarala Devi', student: 'Deepika Reddy' },
  { parent: 'Nagaraju', student: 'Pavan Kalyan' },
  { parent: 'Mahalakshmi', student: 'Sneha Priya' },
  { parent: 'Satyanarayana', student: 'Varun Sai' },
  { parent: 'Bhavani', student: 'Anusha Reddy' },
  { parent: 'Raju', student: 'Karthik Raj' },
  { parent: 'Seetha', student: 'Sravani Kumari' },
  { parent: 'Madhusudhan', student: 'Tejaswi Reddy' },
  { parent: 'Kumar Swamy', student: 'Aditya Sharma' },
  { parent: 'Gangamma', student: 'Swathi Raj' },
  { parent: 'Ranganath', student: 'Rohith Kumar' },
  { parent: 'Jayamma', student: 'Meena Kumari' },
  { parent: 'Subbarao', student: 'Vamsi Krishna' },
  { parent: 'Nagaratnam', student: 'Divya Sri' },
  { parent: 'Appala Raju', student: 'Surya Teja' },
  { parent: 'Sujatha', student: 'Rachana Reddy' },
];

const GROUPS = ['MPC', 'BIPC', 'CEC', 'MEC'];

function randomPhone() {
  const prefix = ['98', '97', '96', '95', '91', '90', '87', '86', '85', '80'];
  const p = prefix[Math.floor(Math.random() * prefix.length)];
  let num = p;
  for (let i = 0; i < 8; i++) num += Math.floor(Math.random() * 10);
  return num;
}

function randomComment() {
  return COMMENTS_POOL[Math.floor(Math.random() * COMMENTS_POOL.length)];
}

function randomStatus() {
  return STATUSES[Math.floor(Math.random() * STATUSES.length)];
}

function randomApproach() {
  return APPROACHES[Math.floor(Math.random() * APPROACHES.length)];
}

function randomGroup() {
  return GROUPS[Math.floor(Math.random() * GROUPS.length)];
}

function daysAgo(n) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function daysFromNow(n) {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}

function randomAddress(division) {
  const areas = {
    'RJY': ['Dowleswaram', 'Katheru', 'Kovvuru Road', 'Main Road', 'Gollala Mamidada'],
    'VJA': ['Benz Circle', 'Governorpet', 'Moghalrajpuram', 'Kanuru', 'Tadepalli'],
    'KAK': ['Suryaraopet', 'JNTU Road', 'Fish Market Junction', 'Vakalapudi', 'Samalkota Road'],
    'TPT': ['Tirumala bypass', 'Renigunta Road', 'Chandragiri', 'Alipiri', 'Mangalam'],
  };
  const list = areas[division] || ['Main Street', 'Center Road'];
  return `${list[Math.floor(Math.random() * list.length)]}, ${division}`;
}

// ─── Main Seed Logic ─────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Samhitha Admissions Tracker — Seed Data Script');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Sign in
  authToken = await signIn('admin@samhitha.edu', 'Admin@123');

  // 2. Get existing users for PRO references
  console.log('\n[INFO] Fetching existing users...');
  const users = await queryCollection('users');
  const proUsers = users.filter(u => u.role === 'PRO' && u.active !== false);
  console.log(`[INFO] Found ${proUsers.length} active PRO users`);

  if (proUsers.length === 0) {
    console.log('[WARN] No PRO users found. Creating leads without assignments.');
  }

  // 3. Seed Divisions
  console.log('\n── Seeding Divisions ──');
  const divisionDocs = [];
  for (const div of DIVISIONS) {
    const existing = await queryCollection('divisions');
    const alreadyExists = existing.find(d => d.code === div.code && d.tenantId === TENANT_ID);
    if (alreadyExists) {
      console.log(`[SKIP] Division ${div.name} (${div.code}) already exists`);
      divisionDocs.push({ id: alreadyExists.id, ...div });
      continue;
    }
    const id = await addDoc('divisions', {
      tenantId: TENANT_ID,
      name: div.name,
      code: div.code,
      description: div.description,
      active: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    });
    divisionDocs.push({ id, ...div });
    await sleep(100);
  }
  console.log(`[DONE] ${divisionDocs.length} divisions ready\n`);

  // 4. Seed Teams
  console.log('── Seeding Teams ──');
  const teamDefs = [
    { name: 'Team RJY-Alpha', divisionIdx: 0 },
    { name: 'Team RJY-Bravo', divisionIdx: 0 },
    { name: 'Team VJA-Alpha', divisionIdx: 1 },
    { name: 'Team KAK-Alpha', divisionIdx: 2 },
  ];
  const teamDocs = [];
  for (const tDef of teamDefs) {
    const div = divisionDocs[tDef.divisionIdx];
    // Assign available PROs round-robin
    const memberIdx = teamDocs.length % Math.max(proUsers.length, 1);
    const memberUids = proUsers.length > 0 ? [proUsers[memberIdx].id] : [];

    const id = await addDoc('teams', {
      tenantId: TENANT_ID,
      name: tDef.name,
      memberUids,
      divisionIds: [div.id],
      active: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    });
    teamDocs.push({ id, ...tDef, divisionId: div.id });
    console.log(`[DB] Team: ${tDef.name} → Division: ${div.name}, PROs: ${memberUids.length}`);
    await sleep(100);
  }
  console.log(`[DONE] ${teamDocs.length} teams created\n`);

  // 5. Seed Leads
  console.log('── Seeding Leads ──');
  const leadDocs = [];
  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i];
    const divIdx = i % divisionDocs.length;
    const div = divisionDocs[divIdx];
    const teamIdx = Math.min(divIdx, teamDocs.length - 1);
    const team = teamDocs[teamIdx];
    const leadNum = String(i + 1).padStart(3, '0');
    const uniqueLeadId = `${div.code}-${leadNum}`;
    const proUser = proUsers.length > 0 ? proUsers[i % proUsers.length] : null;

    const leadData = {
      tenantId: TENANT_ID,
      uniqueLeadId,
      parentName: name.parent,
      studentName: name.student,
      parentPhone: randomPhone(),
      studentPhone: randomPhone(),
      intermediateGroup: randomGroup(),
      address: randomAddress(div.code),
      divisionId: div.id,
      divisionName: div.name,
      divisionCode: div.code,
      teamId: team.id,
      assignedPROUids: proUser ? [proUser.id] : [],
      lastStatusCode: null,
      lastStatusLabel: null,
      lastStatusUpdatedAt: null,
      nextFollowupAt: null,
      active: true,
      createdAt: daysAgo(Math.floor(Math.random() * 30) + 5).toISOString(),
      updatedAt: isoNow,
    };

    const leadId = await addDoc('leads', leadData);
    leadDocs.push({ id: leadId, ...leadData, _divIdx: divIdx, _name: name });
    console.log(`[DB] Lead: ${uniqueLeadId} — ${name.parent} / ${name.student} (${div.name})`);
    await sleep(100);
  }
  console.log(`[DONE] ${leadDocs.length} leads created\n`);

  // 6. Create Lead Assignments
  console.log('── Creating Lead Assignments ──');
  for (const lead of leadDocs) {
    const team = teamDocs[lead._divIdx % teamDocs.length];
    await addDoc('leadAssignments', {
      tenantId: TENANT_ID,
      leadId: lead.id,
      uniqueLeadId: lead.uniqueLeadId,
      parentName: lead.parentName,
      studentName: lead.studentName,
      parentPhone: lead.parentPhone,
      studentPhone: lead.studentPhone,
      divisionId: lead.divisionId,
      divisionName: lead.divisionName,
      divisionCode: lead.divisionCode,
      teamId: team.id,
      teamName: team.name,
      assignedPROUids: lead.assignedPROUids,
      lastStatusCode: null,
      lastStatusLabel: null,
      lastStatusUpdatedAt: null,
      nextFollowupAt: null,
      active: true,
      createdAt: lead.createdAt,
      updatedAt: isoNow,
    });
    await sleep(50);
  }
  console.log(`[DONE] ${leadDocs.length} lead assignments created\n`);

  // 7. Seed Status Updates (30+)
  console.log('── Seeding Status Updates ──');
  let statusUpdateCount = 0;
  for (let i = 0; i < Math.min(leadDocs.length, 20); i++) {
    const lead = leadDocs[i];
    const numUpdates = 1 + Math.floor(Math.random() * 2); // 1-2 updates per lead
    for (let j = 0; j < numUpdates; j++) {
      const status = randomStatus();
      const proUser = proUsers.length > 0 ? proUsers[i % proUsers.length] : null;
      const updateData = {
        tenantId: TENANT_ID,
        leadId: lead.id,
        uniqueLeadId: lead.uniqueLeadId,
        statusCode: status,
        statusLabel: status.replace(/_/g, ' '),
        approachType: randomApproach(),
        comments: randomComment(),
        loggedByUid: proUser ? proUser.id : 'unknown',
        loggedByName: proUser ? proUser.displayName : 'System',
        gpsCaptured: false,
        gpsLocation: null,
        gpsRequired: false,
        createdAt: daysAgo(Math.floor(Math.random() * 14) + 1).toISOString(),
      };

      await addDoc(`leads/${lead.id}/statusUpdates`, updateData);
      statusUpdateCount++;
      await sleep(50);
    }
  }
  // Also update lastStatusCode on leads that have updates
  for (const lead of leadDocs.slice(0, 20)) {
    const status = randomStatus();
    await writeDoc(`leads/${lead.id}`, {
      tenantId: TENANT_ID,
      uniqueLeadId: lead.uniqueLeadId,
      parentName: lead.parentName,
      studentName: lead.studentName,
      parentPhone: lead.parentPhone,
      studentPhone: lead.studentPhone,
      intermediateGroup: lead.intermediateGroup,
      address: lead.address,
      divisionId: lead.divisionId,
      divisionName: lead.divisionName,
      divisionCode: lead.divisionCode,
      teamId: lead.teamId,
      assignedPROUids: lead.assignedPROUids,
      lastStatusCode: status,
      lastStatusLabel: status.replace(/_/g, ' '),
      lastStatusUpdatedAt: daysAgo(Math.floor(Math.random() * 5)).toISOString(),
      nextFollowupAt: daysFromNow(Math.floor(Math.random() * 7) + 1).toISOString(),
      active: true,
      createdAt: lead.createdAt,
      updatedAt: isoNow,
    });
    await sleep(50);
  }
  console.log(`[DONE] ${statusUpdateCount} status updates created\n`);

  // 8. Seed Reminders (10+)
  console.log('── Seeding Reminders ──');
  let reminderCount = 0;
  const reminderNotes = [
    'Follow up on EAMCET results',
    'Schedule campus visit',
    'Discuss fee payment plan',
    'Check if student decided',
    'Send college brochure',
    'Remind about scholarship deadline',
    'Follow up after phone call',
    'Confirm counselling date',
    'Share placement statistics',
    'Ask about branch preference',
  ];
  for (let i = 0; i < Math.min(leadDocs.length, 12); i++) {
    const lead = leadDocs[i];
    const proUser = proUsers.length > 0 ? proUsers[i % proUsers.length] : null;
    const dueDate = daysFromNow(Math.floor(Math.random() * 7));

    await addDoc('reminders', {
      tenantId: TENANT_ID,
      leadId: lead.id,
      uniqueLeadId: lead.uniqueLeadId,
      leadDisplayName: `${lead.parentName} / ${lead.studentName}`,
      recipientUids: proUser ? [proUser.id] : [],
      createdByUid: proUser ? proUser.id : 'system',
      note: reminderNotes[i % reminderNotes.length],
      dueAt: dueDate.toISOString(),
      dueDateOnly: Math.random() > 0.5,
      status: Math.random() > 0.3 ? 'PENDING' : 'COMPLETED',
      createdAt: daysAgo(Math.floor(Math.random() * 3)).toISOString(),
      updatedAt: isoNow,
    });
    reminderCount++;
    await sleep(50);
  }
  console.log(`[DONE] ${reminderCount} reminders created\n`);

  // 9. Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SEEDING COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Divisions:      ${divisionDocs.length}`);
  console.log(`  Teams:          ${teamDocs.length}`);
  console.log(`  Leads:          ${leadDocs.length}`);
  console.log(`  Assignments:    ${leadDocs.length}`);
  console.log(`  Status Updates: ${statusUpdateCount}`);
  console.log(`  Reminders:      ${reminderCount}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
