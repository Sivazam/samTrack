
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'samhitaadmissiontracker' });
const db = admin.firestore();

const TENANT_ID = 'samhitha-college';

const teluguNames = ['Sita', 'Ramu', 'Kiran', 'Priya', 'Radha', 'Pooja', 'Rahul', 'Srinu', 'Nani', 'Anjali', 'Kavya', 'Gopi'];
function randomName() {
    return teluguNames[Math.floor(Math.random() * teluguNames.length)] + ' ' + Math.floor(Math.random()*100);
}

const PROS = [
  { id: 'C6PnLymXUgfJUxLcCi5WP2rCfZE2', displayName: 'Suresh Babu' },
  { id: 'g7wiIHral0gW9gANFUr9vb7CPuy2', displayName: 'Lakshmi Devi' },
  { id: 'uJA6bsHQ0RMurzXskF0MG9tbXI93', displayName: 'Ravi Kumar' }
];

async function clearCollection(collPath) {
    console.log('Clearing ' + collPath);
    const docs = await db.collection(collPath).where('tenantId', '==', TENANT_ID).get();
    const batch = db.batch();
    docs.forEach(d => batch.delete(d.ref));
    if(!docs.empty) {
        await batch.commit();
        console.log('Deleted ' + docs.size + ' docs');
    }
}

(async () => {
    try {
        await clearCollection('leads');
        await clearCollection('teams');
        await clearCollection('divisions');

        // Create Areas
        const eaRef = db.collection('divisions').doc();
        const waRef = db.collection('divisions').doc();
        
        await eaRef.set({ tenantId: TENANT_ID, name: 'East Godavari Area', code: 'EG', active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await waRef.set({ tenantId: TENANT_ID, name: 'West Godavari Area', code: 'WG', active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Create Teams
        const team1Ref = db.collection('teams').doc();
        const team2Ref = db.collection('teams').doc();

        await team1Ref.set({ tenantId: TENANT_ID, name: 'East Team Alpha', divisionIds: [eaRef.id], memberUids: [PROS[0].id, PROS[1].id], active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        await team2Ref.set({ tenantId: TENANT_ID, name: 'West Team Beta', divisionIds: [waRef.id], memberUids: [PROS[2].id], active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Link PROs to teams
        await db.collection('users').doc(PROS[0].id).update({ teamId: team1Ref.id, assignedDivisionIds: [eaRef.id] });
        await db.collection('users').doc(PROS[1].id).update({ teamId: team1Ref.id, assignedDivisionIds: [eaRef.id] });
        await db.collection('users').doc(PROS[2].id).update({ teamId: team2Ref.id, assignedDivisionIds: [waRef.id] });

        // Create Leads
        let leadCount = 1;
        const batch = db.batch();
        for(let i=0; i<10; i++) {
            const lRef = db.collection('leads').doc();
            const parentName = randomName();
            const studentName = randomName();
            batch.set(lRef, {
                tenantId: TENANT_ID,
                uniqueLeadId: 'EG-' + (leadCount++),
                uniqueLeadId_lowercase: ('eg-' + (leadCount-1)),
                parentName, parentName_lowercase: parentName.toLowerCase(),
                studentName, studentName_lowercase: studentName.toLowerCase(),
                divisionId: eaRef.id,
                divisionName: 'East Godavari Area',
                teamId: team1Ref.id,
                assignedPROUids: [PROS[0].id, PROS[1].id],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                active: true,
                parentPhone: '98480' + Math.floor(10000+Math.random()*90000)
            });
        }
        for(let i=0; i<10; i++) {
            const lRef = db.collection('leads').doc();
            const parentName = randomName();
            const studentName = randomName();
            batch.set(lRef, {
                tenantId: TENANT_ID,
                uniqueLeadId: 'WG-' + (leadCount++),
                uniqueLeadId_lowercase: ('wg-' + (leadCount-1)),
                parentName, parentName_lowercase: parentName.toLowerCase(),
                studentName, studentName_lowercase: studentName.toLowerCase(),
                divisionId: waRef.id,
                divisionName: 'West Godavari Area',
                teamId: team2Ref.id,
                assignedPROUids: [PROS[2].id],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                active: true,
                parentPhone: '98481' + Math.floor(10000+Math.random()*90000)
            });
        }
        await batch.commit();

        console.log('Seeded successfully!');
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
})();

