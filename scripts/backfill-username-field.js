const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function backfill() {
  const snap = await db.collection('usernameIndex').get();
  let fixed = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.username) {
      const parts = doc.id.split('__');
      const username = parts.length > 1 ? parts.slice(1).join('__') : doc.id;
      await doc.ref.set({ username: username.toLowerCase() }, { merge: true });
      console.log(`Fixed: ${doc.id} → username: ${username.toLowerCase()}`);
      fixed++;
    }
  }
  console.log(`Done. Fixed ${fixed} of ${snap.size} docs.`);
}

backfill().catch(console.error);
