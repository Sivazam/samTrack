/**
 * Bulk imports leads from XLSX files in a directory.
 * Usage: node scripts/seed-leads.js --tenant=<tenantId> --dir=./data/cities/
 */
const admin = require('firebase-admin');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace('--', '').split('=');
  acc[key] = val;
  return acc;
}, {});

const tenantId = args.tenant;
const dirPath = args.dir || './data/cities/';

if (!tenantId) {
  console.error('Usage: node scripts/seed-leads.js --tenant=<tenantId> --dir=./data/cities/');
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = require('../service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

function cleanPhoneStr(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits.length === 10 ? digits : '';
}

const HEADER_MAP = {
  'sequence': 'uniqueLeadId', 's.no': 'uniqueLeadId', 'sno': 'uniqueLeadId',
  'parent name': 'parentName', 'parent': 'parentName',
  'student name': 'studentName', 'student': 'studentName',
  'parent phone': 'parentPhone', 'parent mobile': 'parentPhone',
  'student phone': 'studentPhone', 'student mobile': 'studentPhone',
  'group': 'intermediateGroup', 'intermediate group': 'intermediateGroup',
  'address': 'address', 'area': 'address',
  'division': 'divisionName', 'city': 'divisionName', 'zone': 'divisionName',
};

async function findTeamForDivision(tenantId, divisionId) {
  const snap = await db.collection('teams')
    .where('tenantId', '==', tenantId)
    .where('divisionIds', 'array-contains', divisionId)
    .where('active', '==', true)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function findDivisionByName(tenantId, name) {
  const snap = await db.collection('divisions')
    .where('tenantId', '==', tenantId)
    .where('name', '==', name)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function processFile(filePath, tenantId) {
  const filename = path.basename(filePath);
  console.log(`\nProcessing: ${filename}`);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) { console.log('  Empty file, skipping'); return; }

  const headers = Object.keys(rows[0]);
  const mapping = {};
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (HEADER_MAP[lower]) mapping[h] = HEADER_MAP[lower];
  }

  console.log(`  ${rows.length} rows, mapped columns: ${Object.values(mapping).join(', ')}`);

  const batchId = db.collection('importBatches').doc().id;
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mapped = {};
    for (const [orig, target] of Object.entries(mapping)) {
      if (row[orig] !== undefined) mapped[target] = String(row[orig]).trim();
    }

    if (!mapped.uniqueLeadId || !mapped.parentName || !mapped.studentName) {
      errors.push({ row: i + 1, reason: 'Missing required fields' });
      errorCount++;
      continue;
    }

    // Check uniqueness
    const existing = await db.collection('leads')
      .where('tenantId', '==', tenantId)
      .where('uniqueLeadId', '==', mapped.uniqueLeadId)
      .limit(1)
      .get();
    if (!existing.empty) { successCount++; continue; } // skip

    // Resolve division
    let divisionId = '';
    let divisionName = mapped.divisionName || '';
    if (divisionName) {
      const divDoc = await findDivisionByName(tenantId, divisionName);
      if (divDoc) { divisionId = divDoc.id; divisionName = divDoc.data().name; }
    }

    // Find team
    let teamId = null;
    let assignedPROUids = [];
    if (divisionId) {
      const teamDoc = await findTeamForDivision(tenantId, divisionId);
      if (teamDoc) { teamId = teamDoc.id; assignedPROUids = teamDoc.data().memberUids || []; }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const leadRef = db.collection('leads').doc();
    const leadId = leadRef.id;

    await leadRef.set({
      tenantId,
      uniqueLeadId: mapped.uniqueLeadId,
      uniqueLeadId_lowercase: mapped.uniqueLeadId.toLowerCase(),
      parentName: mapped.parentName,
      parentName_lowercase: mapped.parentName.toLowerCase(),
      studentName: mapped.studentName,
      studentName_lowercase: mapped.studentName.toLowerCase(),
      parentPhone: cleanPhoneStr(mapped.parentPhone) || null,
      studentPhone: cleanPhoneStr(mapped.studentPhone) || null,
      intermediateGroup: mapped.intermediateGroup || null,
      address: mapped.address || null,
      divisionId,
      divisionName,
      sourceCity: filename.replace(/\.[^.]+$/, ''),
      sourceImportBatchId: batchId,
      teamId,
      assignedPROUids,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('leadAssignments').doc(`${tenantId}__${leadId}`).set({
      tenantId, leadId, teamId, assignedPROUids,
      parentName: mapped.parentName,
      parentName_lowercase: mapped.parentName.toLowerCase(),
      studentName: mapped.studentName,
      studentName_lowercase: mapped.studentName.toLowerCase(),
      uniqueLeadId: mapped.uniqueLeadId,
      uniqueLeadId_lowercase: mapped.uniqueLeadId.toLowerCase(),
      parentPhone: cleanPhoneStr(mapped.parentPhone) || null,
      studentPhone: cleanPhoneStr(mapped.studentPhone) || null,
      divisionId, divisionName,
      lastStatusCode: null, nextFollowupAt: null, active: true,
      createdAt: now, updatedAt: now,
    });

    successCount++;
    if ((i + 1) % 100 === 0) console.log(`  Processed ${i + 1}/${rows.length}...`);
  }

  // Write import batch record
  await db.collection('importBatches').doc(batchId).set({
    tenantId, sourceFilename: filename, uploadedByUid: 'seed-script',
    totalRows: rows.length, successRows: successCount, errorRows: errorCount,
    errors: errors.slice(0, 100), cityFromFilename: filename.replace(/\.[^.]+$/, ''),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`  ✅ ${successCount} success, ${errorCount} errors`);
}

async function main() {
  console.log(`Seeding leads for tenant: ${tenantId}`);
  console.log(`Reading from: ${dirPath}`);

  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv'));
  console.log(`Found ${files.length} files`);

  for (const file of files) {
    await processFile(path.join(dirPath, file), tenantId);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
