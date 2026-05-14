const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCdOIhLQh9iYBXbE7dre2J9zsmCBuVdwwU",
    authDomain: "plkapp-8c052.firebaseapp.com",
    projectId: "plkapp-8c052",
    storageBucket: "plkapp-8c052.firebasestorage.app",
    messagingSenderId: "333526318951",
    appId: "1:333526318951:web:a8f30f497e7060e264b9c2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listTenants() {
    console.log(`📋 LISTING TENANTS`);
    try {
        const snapshot = await getDocs(collection(db, 'tenants'));
        snapshot.forEach(d => {
            console.log(`- ${d.id}: ${d.data().name || 'Unnamed'}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed:', error);
        process.exit(1);
    }
}

listTenants();
