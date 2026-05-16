import { NextResponse } from 'next/server';
import { getFirebaseFirestore } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// ─── Constants ────────────────────────────────────────────────────────────────

const AREAS = [
  { code: 'RJY-CENTRAL', name: 'Rajamahendravaram Central', description: 'Central areas of Rajamahendravaram city' },
  { code: 'RJY-EAST', name: 'Rajamahendravaram East', description: 'Eastern parts of Rajamahendravaram' },
  { code: 'RJY-WEST', name: 'Rajamahendravaram West', description: 'Western parts of Rajamahendravaram' },
  { code: 'RJY-SOUTH', name: 'Rajamahendravaram South', description: 'Southern areas of Rajamahendravaram' },
  { code: 'RJY-NORTH', name: 'Rajamahendravaram North', description: 'Northern areas of Rajamahendravaram' },
  { code: 'KKD', name: 'Kakinada', description: 'Coastal city, East Godavari district' },
  { code: 'TUNI', name: 'Tuni', description: 'Town in East Godavari district' },
  { code: 'MLN', name: 'Mandapeta/Lalacheruvu', description: 'Mandapeta and Lalacheruvu areas' },
];

const TEAM_DEFS = [
  { name: 'Team RJY Core', areaCodes: ['RJY-CENTRAL', 'RJY-EAST', 'RJY-WEST'], proCount: 2 },
  { name: 'Team RJY South', areaCodes: ['RJY-SOUTH', 'RJY-NORTH', 'MLN'], proCount: 2 },
  { name: 'Team Coastal', areaCodes: ['KKD', 'TUNI'], proCount: 1 },
];

const STATUS_OPTIONS = [
  { code: 'NEW', label: 'New Lead', color: '#6366f1', isTerminal: false, order: 1, active: true },
  { code: 'PHONE_UNREACHABLE', label: 'Phone Unreachable', color: '#94a3b8', isTerminal: false, order: 2, active: true },
  { code: 'NOT_ANSWERING', label: 'Not Answering', color: '#94a3b8', isTerminal: false, order: 3, active: true },
  { code: 'NOT_DECIDED', label: 'Not Decided', color: '#94a3b8', isTerminal: false, order: 4, active: true },
  { code: 'WILLING_SAMHITHA', label: 'Willing - Samhitha', color: '#10b981', isTerminal: false, order: 5, active: true },
  { code: 'WAITING_EAMCET', label: 'Waiting for EAMCET', color: '#3b82f6', isTerminal: false, order: 6, active: true },
  { code: 'WAITING_NEET', label: 'Waiting for NEET', color: '#3b82f6', isTerminal: false, order: 7, active: true },
  { code: 'REVISIT_NEEDED', label: 'Revisit Needed', color: '#f97316', isTerminal: false, order: 8, active: true },
  { code: 'JOINED_SAMHITHA', label: 'Joined Samhitha', color: '#059669', isTerminal: true, order: 9, active: true },
  { code: 'JOINED_OTHER', label: 'Joined Other College', color: '#64748b', isTerminal: true, order: 10, active: true },
  { code: 'NOT_INTERESTED_SAMHITHA', label: 'Not Willing - Samhitha', color: '#dc2626', isTerminal: true, order: 11, active: true },
  { code: 'NOT_INTERESTED_DEGREE', label: 'Not Willing - Degree', color: '#dc2626', isTerminal: true, order: 12, active: true },
];

const INTERMEDIATE_GROUPS = [
  { code: 'MPC', label: 'MPC (Maths, Physics, Chemistry)', order: 1, active: true },
  { code: 'BIPC', label: 'BiPC (Biology, Physics, Chemistry)', order: 2, active: true },
  { code: 'MEC', label: 'MEC (Maths, Economics, Commerce)', order: 3, active: true },
  { code: 'CEC', label: 'CEC (Commerce, Economics, Civics)', order: 4, active: true },
  { code: 'OTHER', label: 'Other', order: 5, active: true },
];

const JOINED_COLLEGE_OPTIONS = [
  { code: 'SAMHITHA', label: 'Samhitha College', order: 1, active: true },
  { code: 'OTHER', label: 'Other College', order: 2, active: true },
];

const APPROACH_TYPES: Array<'PHONE' | 'DOORSTEP' | 'WALK_IN' | 'ONLINE'> = ['PHONE', 'DOORSTEP', 'WALK_IN', 'ONLINE'];

const LEAD_NAMES = [
  { parent: 'Ramesh Kumar', student: 'Arjun' },
  { parent: 'Lakshmi Devi', student: 'Priya' },
  { parent: 'Venkateswara Rao', student: 'Rohith' },
  { parent: 'Padmavathi', student: 'Divya' },
  { parent: 'Srinivasa Murthy', student: 'Srikar' },
  { parent: 'Satyavathi', student: 'Manasa' },
  { parent: 'Raja Sekhar', student: 'Nithin' },
  { parent: 'Annapurna', student: 'Sravani' },
  { parent: 'Nageswara Rao', student: 'Vamsi' },
  { parent: 'Lakshmi Narayana', student: 'Harika' },
  { parent: 'Suryanarayana', student: 'Karthik' },
  { parent: 'Rajeshwari', student: 'Sneha' },
  { parent: 'Satyanarayana', student: 'Pavan' },
  { parent: 'Bhavani Devi', student: 'Anusha' },
  { parent: 'Ram Prasad', student: 'Tejaswi' },
  { parent: 'Sujatha', student: 'Surya Teja' },
  { parent: 'Krishna Murthy', student: 'Ravi Teja' },
  { parent: 'Sarala Devi', student: 'Deepika' },
  { parent: 'Subbarao', student: 'Aditya' },
  { parent: 'Gangabhavani', student: 'Swathi' },
  { parent: 'Nagaraju', student: 'Kavya' },
  { parent: 'Mahalakshmi', student: 'Varun Sai' },
  { parent: 'Ranganath', student: 'Meena Kumari' },
  { parent: 'Jayamma', student: 'Sai Kumar' },
  { parent: 'Appala Raju', student: 'Lavanya' },
  { parent: 'Suresh Babu', student: 'Rachana' },
  { parent: 'Seetha Devi', student: 'Kumar Swamy' },
  { parent: 'Madhusudhan Rao', student: 'Pranathi' },
  { parent: 'Nagaratnam', student: 'Durga Prasad' },
  { parent: 'Veerabhadrudu', student: 'Yamini' },
];

const STATUSES = [
  'NEW', 'PHONE_UNREACHABLE', 'NOT_ANSWERING', 'NOT_DECIDED',
  'WILLING_SAMHITHA', 'WAITING_EAMCET', 'WAITING_NEET',
  'REVISIT_NEEDED', 'JOINED_SAMHITHA', 'JOINED_OTHER',
  'NOT_INTERESTED_SAMHITHA', 'NOT_INTERESTED_DEGREE',
];

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
  'Very interested, scheduling campus tour',
  'Parent wants scholarship information',
  'Discussed placement records, impressed',
  'Will decide after counselling',
  'Student already joined another college',
  'Parent asked about hostel facilities',
  'Discussed transport options from Kakinada',
  'Student is preparing for NEET, will decide later',
  'Campus visit scheduled for next week',
  'Parent wants to meet HOD before deciding',
  'Follow up after entrance exam results',
  'Shared brochure and fee details via WhatsApp',
  'Parent concerned about distance from home',
  'Student interested in BiPC stream',
  'Requested information about scholarships',
  'Positive response, will visit with family',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomPhone(): string {
  const prefixes = ['98', '97', '96', '95', '91', '90', '87', '86', '85', '80'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  let num = p;
  for (let i = 0; i < 8; i++) num += Math.floor(Math.random() * 10);
  return num;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAddress(areaCode: string): string {
  const addressMap: Record<string, string[]> = {
    'RJY-CENTRAL': ['Main Road, RJY', 'Clock Tower Area, RJY', 'Kotipalli Bus Stand Area, RJY', 'Danavaipet, RJY'],
    'RJY-EAST': ['Katheru, RJY', 'Rajabhupalapatnam, RJY', 'Vemagiri, RJY', 'GSL Medical College Area, RJY'],
    'RJY-WEST': ['Dowleswaram, RJY', 'Kovvuru Road, RJY', 'Narendrapuram, RJY', 'Bobbillanka, RJY'],
    'RJY-SOUTH': ['Lalacheruvu, RJY', 'Gokavaram Road, RJY', 'Mandapeta Road, RJY', 'Korukonda, RJY'],
    'RJY-NORTH': ['Morampudi, RJY', 'Rajamahendravaram Rural, RJY', 'Duggirala, RJY', 'Kadiyam, RJY'],
    'KKD': ['Suryaraopet, KKD', 'JNTU Road, KKD', 'Main Road, KKD', 'Vakalapudi, KKD'],
    'TUNI': ['Main Road, Tuni', 'Gollala Mamidada, Tuni', 'Kotanandra, Tuni', 'Tuni Town Center'],
    'MLN': ['Mandapeta Center', 'Lalacheruvu Junction', 'Mandapeta Main Road', 'Ramachandrapuram Road, MLN'],
  };
  const addresses = addressMap[areaCode] || ['Main Road'];
  return randomItem(addresses);
}

function daysAgo(n: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return admin.firestore.Timestamp.fromDate(d);
}

function daysFromNow(n: number): admin.firestore.Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9, Math.floor(Math.random() * 12), 0, 0);
  return admin.firestore.Timestamp.fromDate(d);
}

function getStatusLabel(code: string): string {
  const option = STATUS_OPTIONS.find(o => o.code === code);
  return option ? option.label : code.replace(/_/g, ' ');
}

// ─── Main POST Handler ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tenantId = body.tenantId;

    if (!tenantId || typeof tenantId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const db = getFirebaseFirestore();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

    // ── Check idempotency: if areas already exist for this tenant, skip ──
    const existingAreas = await db
      .collection('divisions')
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get();

    if (!existingAreas.empty) {
      return NextResponse.json({
        success: true,
        message: 'Data already exists for this tenant. Skipping seed.',
        skipped: true,
      });
    }

    const counts = {
      areas: 0,
      teams: 0,
      leads: 0,
      leadAssignments: 0,
      statusUpdates: 0,
      reminders: 0,
      tenantConfig: 0,
    };

    // ── 1. Query PRO UIDs from users collection ──
    let proUids: string[] = [];
    const proNames: Record<string, string> = {};
    try {
      const proSnapshot = await db
        .collection('users')
        .where('tenantId', '==', tenantId)
        .where('role', '==', 'PRO')
        .where('active', '==', true)
        .get();

      proSnapshot.forEach(doc => {
        const data = doc.data();
        proUids.push(doc.id);
        proNames[doc.id] = data.displayName || 'PRO User';
      });
    } catch (err) {
      console.warn('[seed-data] Could not query PRO users, continuing without PRO assignments:', err);
    }

    console.log(`[seed-data] Found ${proUids.length} active PRO users for tenant ${tenantId}`);

    // ── 2. Seed Areas (divisions collection) ──
    const areaDocs: Array<{ id: string; code: string; name: string }> = [];
    const areaBatch = db.batch();

    for (const area of AREAS) {
      const areaRef = db.collection('divisions').doc();
      const areaId = areaRef.id;

      areaBatch.set(areaRef, {
        tenantId,
        name: area.name,
        code: area.code,
        description: area.description || null,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      areaDocs.push({ id: areaId, code: area.code, name: area.name });
      counts.areas++;
    }

    await areaBatch.commit();
    console.log(`[seed-data] Created ${counts.areas} areas`);

    // Build a quick lookup map: areaCode → areaDoc
    const areaByCode: Record<string, { id: string; code: string; name: string }> = {};
    for (const a of areaDocs) {
      areaByCode[a.code] = a;
    }

    // ── 3. Seed Teams ──
    const teamDocs: Array<{ id: string; name: string; memberUids: string[]; divisionIds: string[]; areaCodes: string[] }> = [];
    let proIndex = 0;

    const teamBatch = db.batch();

    for (const teamDef of TEAM_DEFS) {
      const teamRef = db.collection('teams').doc();
      const teamId = teamRef.id;

      // Assign PROs round-robin
      const memberUids: string[] = [];
      if (proUids.length > 0) {
        for (let p = 0; p < teamDef.proCount && proIndex < proUids.length; p++) {
          memberUids.push(proUids[proIndex]);
          proIndex++;
        }
      }

      const divisionIds = teamDef.areaCodes
        .map(code => areaByCode[code]?.id)
        .filter(Boolean) as string[];

      teamBatch.set(teamRef, {
        tenantId,
        name: teamDef.name,
        memberUids,
        divisionIds,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      teamDocs.push({ id: teamId, name: teamDef.name, memberUids, divisionIds, areaCodes: teamDef.areaCodes });
      counts.teams++;
    }

    await teamBatch.commit();
    console.log(`[seed-data] Created ${counts.teams} teams`);

    // Build area code → team lookup
    const areaCodeToTeam: Record<string, typeof teamDocs[0]> = {};
    for (const team of teamDocs) {
      for (const code of team.areaCodes) {
        areaCodeToTeam[code] = team;
      }
    }

    // ── 4. Seed Leads + Lead Assignments ──
    const leadsBatch = db.batch();
    const leadDocs: Array<{
      id: string;
      uniqueLeadId: string;
      parentName: string;
      studentName: string;
      divisionId: string;
      divisionName: string;
      teamId?: string;
      assignedPROUids: string[];
      lastStatusCode?: string;
      lastStatusLabel?: string;
      areaCode: string;
    }> = [];

    for (let i = 0; i < LEAD_NAMES.length; i++) {
      const name = LEAD_NAMES[i];
      const areaIdx = i % AREAS.length;
      const area = areaDocs[areaIdx];
      const team = areaCodeToTeam[area.code];

      // Generate unique lead ID as a sequential string
      const uniqueLeadId = String(i + 1);

      const assignedPROUids = team ? team.memberUids : [];
      const teamId = team ? team.id : undefined;

      // Assign a random status to each lead
      const statusCode = randomItem(STATUSES);
      const statusLabel = getStatusLabel(statusCode);

      const leadRef = db.collection('leads').doc();
      const leadId = leadRef.id;

      const leadData = {
        tenantId,
        uniqueLeadId,
        parentName: name.parent,
        parentName_lowercase: name.parent.toLowerCase(),
        studentName: name.student,
        studentName_lowercase: name.student.toLowerCase(),
        parentPhone: randomPhone(),
        studentPhone: Math.random() > 0.5 ? randomPhone() : null,
        intermediateGroup: randomItem(['MPC', 'BIPC', 'MEC', 'CEC']),
        address: randomAddress(area.code),
        divisionId: area.id,
        divisionName: area.name,
        teamId: teamId || null,
        assignedPROUids,
        lastStatusCode: statusCode,
        lastStatusLabel: statusLabel,
        lastStatusAt: daysAgo(Math.floor(Math.random() * 7) + 1),
        lastApproachType: randomItem(APPROACH_TYPES),
        active: true,
        createdAt: daysAgo(Math.floor(Math.random() * 30) + 5),
        updatedAt: daysAgo(Math.floor(Math.random() * 3)),
      };

      leadsBatch.set(leadRef, leadData);

      // Create matching leadAssignment document
      const assignmentRef = db.collection('leadAssignments').doc();
      leadsBatch.set(assignmentRef, {
        tenantId,
        leadId,
        uniqueLeadId,
        parentName: name.parent,
        parentName_lowercase: name.parent.toLowerCase(),
        studentName: name.student,
        studentName_lowercase: name.student.toLowerCase(),
        parentPhone: leadData.parentPhone,
        studentPhone: leadData.studentPhone,
        divisionId: area.id,
        divisionName: area.name,
        teamId: teamId || null,
        assignedPROUids,
        lastStatusCode: statusCode,
        active: true,
        createdAt: leadData.createdAt,
        updatedAt: leadData.updatedAt,
      });

      leadDocs.push({
        id: leadId,
        uniqueLeadId,
        parentName: name.parent,
        studentName: name.student,
        divisionId: area.id,
        divisionName: area.name,
        teamId,
        assignedPROUids,
        lastStatusCode: statusCode,
        lastStatusLabel: statusLabel,
        areaCode: area.code,
      });

      counts.leads++;
      counts.leadAssignments++;
    }

    await leadsBatch.commit();
    console.log(`[seed-data] Created ${counts.leads} leads and ${counts.leadAssignments} lead assignments`);

    // ── 5. Seed Status Updates (subcollection: leads/{leadId}/statusUpdates) ──
    const statusBatch = db.batch();
    let statusOpsCount = 0;

    for (let i = 0; i < leadDocs.length; i++) {
      const lead = leadDocs[i];
      const numUpdates = 1 + Math.floor(Math.random() * 3); // 1-3 updates

      for (let j = 0; j < numUpdates; j++) {
        const statusCode = randomItem(STATUSES);
        const statusLabel = getStatusLabel(statusCode);
        const approachType = randomItem(APPROACH_TYPES);
        const loggedByUid = lead.assignedPROUids.length > 0
          ? randomItem(lead.assignedPROUids)
          : 'system';
        const loggedByName = loggedByUid !== 'system' && proNames[loggedByUid]
          ? proNames[loggedByUid]
          : 'System';

        const updateRef = db
          .collection('leads')
          .doc(lead.id)
          .collection('statusUpdates')
          .doc();

        statusBatch.set(updateRef, {
          tenantId,
          leadId: lead.id,
          approachType,
          statusCode,
          statusLabel,
          comments: randomItem(COMMENTS_POOL),
          loggedByUid,
          loggedByName,
          gpsRequired: false,
          gpsCaptured: false,
          createdAt: daysAgo(Math.floor(Math.random() * 20) + 1),
        });

        counts.statusUpdates++;
        statusOpsCount++;

        // Firestore batch limit: 500 ops — commit and create new batch if approaching limit
        if (statusOpsCount >= 450) {
          await statusBatch.commit();
          statusOpsCount = 0;
        }
      }
    }

    if (statusOpsCount > 0) {
      await statusBatch.commit();
    }
    console.log(`[seed-data] Created ${counts.statusUpdates} status updates`);

    // ── 6. Seed Reminders (8 reminders for various leads) ──
    const reminderBatch = db.batch();
    const reminderNotes = [
      'Follow up on EAMCET results',
      'Schedule campus visit',
      'Discuss fee payment plan',
      'Check if student decided',
      'Send college brochure',
      'Remind about scholarship deadline',
      'Follow up after phone call',
      'Confirm counselling date',
    ];

    const reminderStatuses: Array<'PENDING' | 'SENT' | 'COMPLETED'> = ['PENDING', 'SENT', 'COMPLETED'];

    for (let i = 0; i < 8; i++) {
      const lead = leadDocs[i % leadDocs.length];
      const reminderRef = db.collection('reminders').doc();

      const recipientUids = lead.assignedPROUids.length > 0
        ? [randomItem(lead.assignedPROUids)]
        : [];
      const createdByName = recipientUids.length > 0 && proNames[recipientUids[0]]
        ? proNames[recipientUids[0]]
        : 'Admin';

      reminderBatch.set(reminderRef, {
        tenantId,
        leadId: lead.id,
        leadDisplayName: `${lead.parentName} / ${lead.studentName}`,
        uniqueLeadId: lead.uniqueLeadId,
        dueAt: daysFromNow(Math.floor(Math.random() * 7) + 1),
        dueDateOnly: Math.random() > 0.5,
        note: reminderNotes[i],
        createdByName,
        recipientUids,
        status: randomItem(reminderStatuses),
        createdAt: daysAgo(Math.floor(Math.random() * 5)),
        updatedAt: daysAgo(Math.floor(Math.random() * 2)),
      });

      counts.reminders++;
    }

    await reminderBatch.commit();
    console.log(`[seed-data] Created ${counts.reminders} reminders`);

    // ── 7. Seed Tenant Config ──
    const configRef = db.collection('tenantConfig').doc(tenantId);
    await configRef.set({
      tenantId,
      statusOptions: STATUS_OPTIONS,
      intermediateGroups: INTERMEDIATE_GROUPS,
      joinedCollegeOptions: JOINED_COLLEGE_OPTIONS,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    counts.tenantConfig = 1;
    console.log(`[seed-data] Created tenant config`);

    // ── Summary ──
    console.log(`[seed-data] ═══════════════════════════════════════════`);
    console.log(`[seed-data]   SEEDING COMPLETE for tenant: ${tenantId}`);
    console.log(`[seed-data]   Areas:            ${counts.areas}`);
    console.log(`[seed-data]   Teams:            ${counts.teams}`);
    console.log(`[seed-data]   Leads:            ${counts.leads}`);
    console.log(`[seed-data]   Lead Assignments: ${counts.leadAssignments}`);
    console.log(`[seed-data]   Status Updates:   ${counts.statusUpdates}`);
    console.log(`[seed-data]   Reminders:        ${counts.reminders}`);
    console.log(`[seed-data]   Tenant Config:    ${counts.tenantConfig}`);
    console.log(`[seed-data] ═══════════════════════════════════════════`);

    return NextResponse.json({
      success: true,
      message: `Seed data created successfully for tenant: ${tenantId}`,
      counts,
    });
  } catch (error: any) {
    console.error('[seed-data] Error seeding data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
