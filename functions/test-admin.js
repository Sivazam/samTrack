
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'samhitaadmissiontracker' });
const db = admin.firestore();
(async () => {
    console.log('Fetching...');
    try {
        const snap = await db.collection('leads').limit(1).get();
        console.log('Docs:', snap.size);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
})();

