#!/usr/bin/env node
/**
 * Seeds comprehensive dummy data for Samhitha College.
 *
 * ⚠️ IMPORTANT: This script writes to Firestore collections that are
 * normally "CF-only" (Cloud Functions). Before running this script,
 * you must temporarily relax the Firestore rules.
 *
 * STEPS:
 * 1. In firestore.rules, change all `allow write: if false;` to `allow write: if isAuthenticated();`
 * 2. Deploy: firebase deploy --only firestore:rules
 * 3. Run: node scripts/seed-dummy-data.js
 * 4. Revert the rules and deploy again
 *
 * Alternative: If you have service-account.json, use the Admin SDK
 * approach (see seed-initial-tenant.js for the pattern).
 */

const https = require('https');
const API_KEY = 'AIzaSyCNOdmucv2HATHD7Ir7-K18fCIwIpzQaeQ';
const PROJECT_ID = 'samhitaadmissiontracker';
const TENANT_ID = 'samhitha-college';
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// PRO user UIDs (from seed-test-users.js)
const PRO_USERS = [
  { uid: 'uJA6bsHQ0RMurzXskF0MG9tbXI93', email: 'pro1@samhitha.edu', displayName: 'Ravi Kumar' },
  { uid: 'C6PnLymXUgfJUxLcCi5WP2rCfZE2', email: 'pro2@samhitha.edu', displayName: 'Suresh Babu' },
  { uid: 'g7wiIHral0gW9gANFUr9vb7CPuy2', email: 'pro3@samhitha.edu', displayName: 'Lakshmi Devi' },
];

const DIVISIONS = [
  { name: 'Rajahmundry', code: 'RJY' },
  { name: 'Kakinada', code: 'KKD' },
  { name: 'Amalapuram', code: 'AML' },
  { name: 'Tadepalligudem', code: 'TDP' },
  { name: 'Eluru', code: 'ELR' },
  { name: 'Bhimavaram', code: 'BVM' },
  { name: 'Narasapuram', code: 'NRS' },
  { name: 'Tanuku', code: 'TNK' },
];

const TELUGU_NAMES = [
  'Ravi Kumar', 'Suresh Babu', 'Lakshmi Devi', 'Venkat Rao', 'Padma Priya',
  'Krishna Murthy', 'Sita Ramudu', 'Ramu Naidu', 'Anjali Devi', 'Rajesh Kumar',
  'Priya Sharma', 'Srinivas Reddy', 'Meena Kumari', 'Nageswara Rao', 'Swathi Reddy',
  'Prasad Babu', 'Kavitha Devi', 'Sambasiva Rao', 'Latha Kumari', 'Gopal Krishna',
  'Divya Sri', 'Ramesh Babu', 'Sunitha Devi', 'Siva Shankar', 'Arun Kumar',
  'Padmavathi', 'Venkateshulu', 'Bhavana Sri', 'Mahesh Babu', 'Vijaya Lakshmi',
  'Sathish Kumar', 'Nirmala Devi', 'Hari Prasad', 'Sarada Devi', 'Phani Kumar',
  'Rajyalakshmi', 'Kiran Kumar', 'Satyavathi', 'Sudhakar Rao', 'Annapurna',
  'Naveen Kumar', 'Sujatha Devi', 'Ranganath', 'Pushpa Latha', 'Ashok Kumar',
  'Malleswari', 'Durga Prasad', 'Vasundhara', 'Subhash Chandra', 'Yamuna Devi',
  'Chandra Sekhar', 'Lakshman Rao', 'Bhanu Prakash', 'Sai Kumar', 'Durga Rao',
  'Siva Rama Krishna', 'Rama Devi', 'Vamsi Krishna', 'Santosh Kumar', 'Radha Devi',
];

const INTERMEDIATE_GROUPS = ['MPC', 'BIPC', 'CEC', 'MEC'];
const STATUS_FLOW = [
  { code: 'WAITING_EAMCET', label: 'Waiting EAMCET' },
  { code: 'WILLING_DEGREE', label: 'Willing Degree' },
  { code: 'WILLING_SAMHITHA', label: 'Willing Samhitha' },
  { code: 'JOINED_SAMHITHA', label: 'Joined Samhitha' },
];
const ALT_STATUS = [
  { code: 'WAITING_NEET', label: 'Waiting NEET' },
  { code: 'NOT_INTERESTED_DEGREE', label: 'Not Interested Degree' },
  { code: 'NOT_DECIDED', label: 'Not Decided' },
  { code: 'PHONE_UNREACHABLE', label: 'Phone Unreachable' },
  { code: 'REVISIT_NEEDED', label: 'Revisit Needed' },
  { code: 'NOT_ANSWERING', label: 'Not Answering' },
];
const APPROACH_TYPES = ['PHONE', 'DOORSTEP', 'WALK_IN', 'ONLINE'];

function randomPhone() { return '9' + String(Math.floor(Math.random() * 9000000000 + 1000000000)); }
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function httpsRequest(url, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let c = ''; res.on('data', d => c += d);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(c) }); } catch { resolve({ status: res.statusCode, data: c }); } });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.length > 0 ? v.map(toValue) : [] } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(obj) { const out = {}; for (const [k, v] of Object.entries(obj)) out[k] = toValue(v); return out; }

async function writeDoc(path, data, idToken) {
  const res = await httpsRequest(`${FS_BASE}/${path}`, 'PATCH', { fields: toFields(data) }, { Authorization: `Bearer ${idToken}` });
  if (res.status >= 400) throw new Error(`Write failed (${res.status}): ${(typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).substring(0, 300)}`);
  return res;
}
async function createDoc(colPath, data, idToken) {
  const res = await httpsRequest(`${FS_BASE}/${colPath}`, 'POST', { fields: toFields(data) }, { Authorization: `Bearer ${idToken}` });
  if (res.status >= 400) throw new Error(`Create failed (${res.status}): ${(typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).substring(0, 300)}`);
  const docName = res.data?.name || '';
  return { id: docName.split('/').pop() || '', data: res.data };
}
async function signInUser(email, password) {
  const res = await httpsRequest(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, 'POST', { email, password, returnSecureToken: true });
  if (res.status >= 400) throw new Error(`Sign-in failed: ${JSON.stringify(res.data)}`);
  return { uid: res.data.localId, idToken: res.data.idToken };
}

async function seed() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   Samhitha College — Dummy Data Seeder          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  console.log('🔐 Signing in as admin@samhitha.edu...');
  const { idToken } = await signInUser('admin@samhitha.edu', 'Admin@123');
  console.log('   ✅ Signed in\n');

  const now = new Date().toISOString();
  const divisionIds = {}, divisionNames = {};

  // 1. Divisions
  console.log('📍 Creating divisions...');
  for (const div of DIVISIONS) {
    const docId = `${TENANT_ID}_${div.code}`;
    try {
      await writeDoc(`divisions/${docId}`, { tenantId: TENANT_ID, name: div.name, code: div.code, active: true, createdAt: now, updatedAt: now }, idToken);
      divisionIds[div.code] = docId;
      divisionNames[div.code] = div.name;
      console.log(`   ✅ ${div.name} (${div.code})`);
    } catch (e) { console.log(`   ❌ ${div.name}: ${e.message.substring(0, 100)}`); }
  }
  console.log('');

  // 2. Teams
  console.log('👥 Creating teams...');
  const teams = [
    { name: 'Team Alpha', proIndices: [0, 1], divisionCodes: ['RJY', 'KKD', 'AML'] },
    { name: 'Team Beta', proIndices: [1, 2], divisionCodes: ['TDP', 'ELR', 'BVM'] },
    { name: 'Team Gamma', proIndices: [2], divisionCodes: ['NRS', 'TNK'] },
  ];
  for (const team of teams) {
    const members = team.proIndices.map(i => PRO_USERS[i]);
    const divIds = team.divisionCodes.map(c => divisionIds[c]).filter(Boolean);
    try {
      await createDoc('teams', { tenantId: TENANT_ID, name: team.name, memberUids: members.map(m => m.uid), memberNames: members.map(m => m.displayName), divisionIds: divIds, active: true, createdAt: now, updatedAt: now }, idToken);
      console.log(`   ✅ ${team.name}`);
    } catch (e) { console.log(`   ❌ ${team.name}: ${e.message.substring(0, 100)}`); }
  }
  console.log('');

  // 3. Leads + Assignments
  console.log('📋 Creating leads...');
  let leadCount = 0, updateCount = 0;
  const leadDataArr = [];
  for (let i = 0; i < 50; i++) {
    const divCode = DIVISIONS[i % DIVISIONS.length].code;
    const divId = divisionIds[divCode];
    const divName = divisionNames[divCode];
    if (!divId) continue;
    const uniqueId = `${divCode}-${String(i + 1).padStart(3, '0')}`;
    const parentName = TELUGU_NAMES[i % TELUGU_NAMES.length];
    const studentName = TELUGU_NAMES[(i + 15) % TELUGU_NAMES.length];
    const group = INTERMEDIATE_GROUPS[i % INTERMEDIATE_GROUPS.length];
    const pro = PRO_USERS[i % PRO_USERS.length];

    const r = Math.random();
    const cs = r < 0.15 ? STATUS_FLOW[0] : r < 0.30 ? STATUS_FLOW[1] : r < 0.50 ? STATUS_FLOW[2] : r < 0.65 ? STATUS_FLOW[3] : randomItem(ALT_STATUS);

    const leadDocId = `${TENANT_ID}_${uniqueId}`;
    const leadObj = { tenantId: TENANT_ID, uniqueLeadId: uniqueId, parentName, studentName, parentPhone: randomPhone(), studentPhone: Math.random() > 0.5 ? randomPhone() : null, intermediateGroup: group, address: `${randomInt(1, 200)}, ${divName} Main Road`, divisionId: divId, divisionName: divName, assignedPROUids: [pro.uid], currentStatusCode: cs.code, currentStatusLabel: cs.label, lastStatusCode: cs.code, lastStatusLabel: cs.label, active: true, createdAt: now, updatedAt: now };

    try {
      await writeDoc(`leads/${leadDocId}`, leadObj, idToken);
      await writeDoc(`leadAssignments/${leadDocId}`, { ...leadObj, leadId: leadDocId, nextFollowupAt: null }, idToken);
      leadDataArr.push({ ...leadObj, id: leadDocId });
      leadCount++;

      // Status updates for first 30
      if (i < 30) {
        const num = randomInt(2, 4);
        for (let j = 0; j < num && j < STATUS_FLOW.length; j++) {
          const approach = j === 0 ? 'PHONE' : randomItem(APPROACH_TYPES);
          const ud = new Date(Date.now() - (num - j) * 86400000).toISOString();
          const comments = ['Initial contact made', 'Follow-up discussion', 'Parent showed interest', 'Student willing to join'][j] || 'Follow-up';
          try {
            await createDoc(`leads/${leadDocId}/statusUpdates`, { tenantId: TENANT_ID, leadId: leadDocId, statusCode: STATUS_FLOW[j].code, statusLabel: STATUS_FLOW[j].label, approachType: approach, comments, loggedByUid: pro.uid, loggedByName: pro.displayName, gpsCaptured: approach === 'DOORSTEP' || approach === 'WALK_IN', gpsLocation: null, createdAt: ud }, idToken);
            updateCount++;
          } catch (e) { /* skip */ }
        }
      }

      if ((i + 1) % 10 === 0) console.log(`   ... ${i + 1}/50 leads`);
    } catch (e) { console.log(`   ❌ Lead ${uniqueId}: ${e.message.substring(0, 100)}`); }
  }
  console.log(`   ✅ ${leadCount} leads, ${updateCount} updates\n`);

  // 4. Reminders
  console.log('🔔 Creating reminders...');
  const notes = ['Follow up on admission', 'Call about fee structure', 'Schedule campus visit', 'Send application link', 'Discuss scholarships', 'Parent meeting', 'Share brochure', 'Confirm enrollment', 'Check EAMCET results', 'Re-engage missed call', 'Send offer letter', 'Verify documents', 'Hostel discussion', 'Transport inquiry', 'Payment plan'];
  let remCount = 0;
  for (let i = 0; i < Math.min(15, leadDataArr.length); i++) {
    const lead = leadDataArr[i];
    const pro = PRO_USERS[i % PRO_USERS.length];
    const due = new Date(Date.now() + (i - 5) * 86400000).toISOString();
    try {
      await createDoc('reminders', { tenantId: TENANT_ID, leadId: lead.id, leadDisplayName: `${lead.parentName} / ${lead.studentName}`, recipientUids: [pro.uid], note: notes[i] || 'Follow up', status: new Date(due) < new Date() ? 'SENT' : 'PENDING', dueAt: due, dueDateOnly: Math.random() > 0.5, snoozeCount: 0, createdAt: now, updatedAt: now }, idToken);
      remCount++;
    } catch (e) { /* skip */ }
  }
  console.log(`   ✅ ${remCount} reminders\n`);

  // 5. Stats
  console.log('📊 Updating tenant stats...');
  try {
    await writeDoc(`tenant_stats/${TENANT_ID}`, {
      tenantId: TENANT_ID, totalLeads: leadCount, totalActiveLeads: leadCount,
      joinedSamhithaCount: Math.floor(leadCount * 0.15), followupsDueToday: 5,
      statusBreakdown: { WAITING_EAMCET: 8, WAITING_NEET: 3, WILLING_DEGREE: 8, WILLING_SAMHITHA: 10, JOINED_SAMHITHA: 8, NOT_DECIDED: 5, NOT_INTERESTED_DEGREE: 4, PHONE_UNREACHABLE: 2, REVISIT_NEEDED: 2 },
      updatedAt: now,
    }, idToken);
    console.log('   ✅ Stats updated\n');
  } catch (e) { console.log(`   ❌ Stats: ${e.message.substring(0, 100)}\n`); }

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║                  SEEDING COMPLETE                 ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Divisions       : ${String(DIVISIONS.length).padEnd(4)}                            ║`);
  console.log(`║  Teams           : ${String(teams.length).padEnd(4)}                            ║`);
  console.log(`║  Leads           : ${String(leadCount).padEnd(4)}                            ║`);
  console.log(`║  Status Updates  : ${String(updateCount).padEnd(4)}                            ║`);
  console.log(`║  Reminders       : ${String(remCount).padEnd(4)}                            ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');
}

seed().catch(e => { console.error('💥 Fatal:', e.message || e); process.exit(1); });
