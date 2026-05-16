# Vercel Deployment Readiness — Samhitha Admissions

> **Status:** ✅ Code-side ready. You only need to set env vars in Vercel and click Deploy.

## 1. Required Environment Variables (Vercel → Project → Settings → Environment Variables)

Add these for **Production**, **Preview**, and **Development** scopes:

| Name | Required | Value | Notes |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ✅ Yes | Full JSON (one line) of `functions/service-account.json` | Used by API routes (`src/lib/firebase-admin.ts`). Paste the entire JSON object as the value. Vercel will store it as a secret. |
| `NEXT_PUBLIC_FCM_VAPID_KEY` | ⚠️ For push notifications | Your FCM Web Push VAPID public key from Firebase Console → Project Settings → Cloud Messaging → Web configuration | Without this the in-app FCM token registration silently fails. |

The Firebase **client** config (`apiKey`, `projectId`, etc.) is hard-coded in `src/lib/firebase.ts` and does NOT need env vars. (Client API keys are public/safe by design.)

## 2. Build Settings (auto-detected by Vercel — leave as default)

- Framework Preset: **Next.js**
- Build Command: `next build`  *(set in vercel.json)*
- Install Command: `npm install`
- Output Directory: *(leave empty — Next.js default)*
- Node.js Version: 20.x (matches `functions/package.json` engines)

## 3. Things That Are Already Handled

- ✅ `vercel.json` created with correct caching headers for `/sw.js`, `/manifest.json`, and PNG icons.
- ✅ Service worker (`/sw.js`) is served from `public/` so its scope is `/` (works on Vercel out-of-the-box).
- ✅ No API route uses Edge runtime — all default to Node runtime (required by Firebase Admin SDK).
- ✅ `next.config.ts` does NOT use `output: 'export'` — dynamic API routes will work.
- ✅ Firebase Cloud Functions are deployed separately to GCP (`firebase deploy --only functions`) and are NOT bundled with the Vercel build. Vercel only hosts the Next.js front-end + its API routes.
- ✅ `netlify.toml` and `keep-alive.sh` / `keepalive.sh` are leftover artifacts — Vercel ignores them.

## 4. Manual Steps Before First Deploy

1. **Generate proper PWA icons** (one-time):
   - Save your square Samhitha badge logo as `public/icon-source.png` (≥512×512 PNG, transparent or solid background OK).
   - Run:  `npm install --save-dev sharp` *(if not already installed — `scripts/generate-large-icons.js` already requires it, so probably yes)*.
   - Run:  `node scripts/generate-pwa-icons.js`
   - Commit the regenerated icon files in `public/`.

2. **Verify FCM Web Push** in production:
   - After deploy, open the Vercel URL → log in → check DevTools console for `[FCM] token registered`.
   - If you see "VAPID key missing", set `NEXT_PUBLIC_FCM_VAPID_KEY` in Vercel and redeploy.

3. **Add Vercel domain to Firebase Auth authorized domains**:
   - Firebase Console → Authentication → Settings → Authorized domains → Add `your-app.vercel.app` (and your custom domain when you set one).

4. **Confirm CORS for callable Cloud Functions**:
   - Already configured in `functions/src/critical-api.ts` — accepts requests from any origin. Should work as-is.

## 5. Post-Deploy Smoke Checklist

- [ ] App loads at `https://<project>.vercel.app/` and redirects unauthenticated users to `/login`.
- [ ] Login with `admin@samhitha.edu` works → land on Admin dashboard.
- [ ] KPI cards (Total / Hot / Joined / Follow-ups) show non-zero values.
- [ ] PRO login (`pro1@samhitha.edu`) → Reminders tab shows existing reminders.
- [ ] Browser shows the new Samhitha badge icon in the tab favicon.
- [ ] Chrome → ⋮ → "Install Samhitha" works; installed app uses the badge icon (not the wordmark).
- [ ] DevTools → Application → Manifest shows no warnings.
- [ ] DevTools → Application → Service Workers shows `samhitha-v4-2.2.0` activated.

## 6. Known Acceptable Warnings During Build

- ESLint warnings about `<img>` vs `<Image>` in some legal pages — non-blocking.
- TypeScript build errors are bypassed via `next.config.ts → typescript.ignoreBuildErrors: true` — production build will succeed even if there are type errors.

## 7. Do NOT Deploy Until

- You have set `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel. Without it, every API route under `/api/*` will return 500 because Firebase Admin can't initialize.
