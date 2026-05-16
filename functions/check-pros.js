
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'samhitaadmissiontracker' });
const db = admin.firestore();
(async () => {
    const users = await db.collection('users').where('tenantId','==','samhitha-college').get();
    let pros = [];
    users.forEach(d => {
        if(d.data().role === 'PRO') pros.push({id: d.id, displayName: d.data().displayName, teamId: d.data().teamId});
    });
    console.log('PROs:', pros);
    process.exit(0);
})();

