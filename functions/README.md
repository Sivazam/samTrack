# Firebase Service Account Setup

## Instructions:

1. Download the service account JSON file from Firebase Console:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the downloaded file

2. Rename the downloaded file to `service-account.json`

3. Place it in this directory: `functions/service-account.json`

4. The file should look like this:
   ```json
   {
     "type": "service_account",
     "project_id": "plkapp-8c052",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "firebase-adminsdk-xxxxx@plkapp-8c052.iam.gserviceaccount.com",
     ...
   }
   ```

5. **IMPORTANT**: This file contains sensitive credentials. It's already in .gitignore and should NEVER be committed to Git.

## Security:
- ✅ Already added to .gitignore
- ✅ Only used server-side (Next.js API routes)
- ✅ Never exposed to client
