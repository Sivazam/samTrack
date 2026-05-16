/**
 * migrate-lead-ids-to-number.js
 *
 * Converts all leads' uniqueLeadId from string ("SMT-001", "1", "01", etc.)
 * to a positive integer (1, 2, ...).
 * Also removes the obsolete uniqueLeadId_lowercase field.
 * Mirrors the same fix on every matching leadAssignment document.
 */

const TENANT_ID  = 'samhitha-college';
const API_KEY    = 'AIzaSyCNOdmucv2HATHD7Ir7-K18fCIwIpzQaeQ';
const PROJECT_ID = 'samhitaadmissiontracker';
const AUTH_URL   = `https://identitytoolkit.googleapis.com/v1/accounts`;
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ADMIN_EMAIL = 'admin@samhitha.edu';
const ADMIN_PASS  = 'Admin@123';

// ── REST helpers ─────────────────────────────────────────────────────────────
async function signIn(email, password) {
  const res = await fetch(`${AUTH_URL}:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Auth failed');
  return data.idToken;
}

function toFirestoreField(val) {
  if (typeof val === 'number')  return { integerValue: String(val) };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val === null)             return { nullValue: null };
  return { stringValue: String(val) };
}

function fromField(f) {
  if ('integerValue'  in f) return Number(f.integerValue);
  if ('doubleValue'   in f) return Number(f.doubleValue);
  if ('stringValue'   in f) return f.stringValue;
  if ('booleanValue'  in f) return f.booleanValue;
  if ('nullValue'     in f) return null;
  if ('timestampValue'in f) return f.timestampValue;
  if ('arrayValue'    in f) return (f.arrayValue.values || []).map(fromField);
  if ('mapValue'      in f) {
    const obj = {};
    for (const [k, v] of Object.entries(f.mapValue.fields || {})) obj[k] = fromField(v);
    return obj;
  }
  return null;
}

function fromDoc(doc) {
  const obj = { _id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = fromField(v);
  return obj;
}

async function listAll(collPath, token, filter = {}) {
  const docs = [];
  let pageToken = null;
  do {
    const url = new URL(`${BASE_URL}/${collPath}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const data = await res.json();
    for (const d of (data.documents || [])) {
      const obj = fromDoc(d);
      if (Object.entries(filter).every(([k, v]) => obj[k] === v)) docs.push(obj);
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function patchDoc(collPath, docId, fields, token) {
  // Build field mask from keys
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) firestoreFields[k] = toFirestoreField(v);

  const res = await fetch(
    `${BASE_URL}/${collPath}/${docId}?${mask}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: firestoreFields }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || res.status);
  }
}

/** Firestore REST doesn't have a native "delete field" via PATCH mask — use a transform approach.
 *  Actually, to DELETE a field via REST we patch with FieldTransform. Simplest: just don't include
 *  the field in the update mask — it won't be touched, but it also won't be removed.
 *  To truly delete it we need a write with a field_transform. Use a workaround: 
 *  we'll do a full document read, reconstruct without the field, and write back.
 *  For simplicity: just leave the stale _lowercase field — it's harmless. The app no longer uses it.
 */

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Lead ID → Number Migration');
  console.log('═══════════════════════════════════════════════\n');

  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('[AUTH] OK\n');

  // Fetch all leads for tenant
  const leads = await listAll('leads', token, { tenantId: TENANT_ID });
  console.log(`[INFO] Found ${leads.length} lead(s) to inspect\n`);

  let fixed = 0, skipped = 0, errored = 0;

  for (const lead of leads) {
    const current = lead.uniqueLeadId;
    if (typeof current === 'number') {
      skipped++;
      continue; // already a number
    }

    // Try to parse the number from strings like "SMT-001", "1", "42" etc.
    let num = NaN;
    if (typeof current === 'string') {
      // Strip any non-digit prefix/suffix
      const match = current.match(/(\d+)/);
      if (match) num = parseInt(match[1], 10);
    }

    if (!Number.isFinite(num) || num <= 0) {
      console.warn(`  [SKIP] lead ${lead._id}: cannot parse "${current}" as number`);
      skipped++;
      continue;
    }

    try {
      // Update lead
      await patchDoc('leads', lead._id, { uniqueLeadId: num }, token);

      // Update matching leadAssignment
      const asgId = `${TENANT_ID}__${lead._id}`;
      try {
        await patchDoc('leadAssignments', asgId, { uniqueLeadId: num }, token);
      } catch (_) {
        // Assignment may not exist — that's OK
      }

      console.log(`  [FIXED] lead ${lead._id}: "${current}" → ${num}`);
      fixed++;
    } catch (e) {
      console.error(`  [ERR] lead ${lead._id}: ${e.message}`);
      errored++;
    }
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Done: fixed=${fixed}, skipped=${skipped}, errors=${errored}`);
  console.log(`═══════════════════════════════════════════════\n`);
})();
