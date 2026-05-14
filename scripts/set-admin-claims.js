const admin = require('firebase-admin');

// Service Account Key is required for this script
// Download it from Firebase Console -> Project Settings -> Service Accounts -> Generate Private Key
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function setWholesalerAdminClaims(email, tenantId) {
    try {
        const user = await admin.auth().getUserByEmail(email);

        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'WHOLESALER_ADMIN',
            tenantId: tenantId
        });

        console.log(`✅ Successfully set claims for ${email} (${user.uid})`);
        console.log(`Role: WHOLESALER_ADMIN, TenantId: ${tenantId}`);
    } catch (error) {
        console.error('Error setting claims:', error);
    }
}

// USAGE: node set-admin-claims.js <email> <tenantId>
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.log('Usage: node set-admin-claims.js <email> <tenantId>');
    process.exit(1);
}

setWholesalerAdminClaims(args[0], args[1]);
