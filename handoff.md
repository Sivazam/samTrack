# SAMHITHA ADMISSIONS TRACKER — HANDOFF PROMPT

> **To the AI agent that built this project**: this is a status + completion brief.
> **Project root**: `C:\Users\aviS\Downloads\samhitha_track`
> **Domain**: College admissions lead-tracking PWA for Samhitha College.
> **Stack**: Next.js 16 + React 19 + TypeScript 5 + Firebase 12 (Auth + Firestore + FCM + Storage) + Cloud Functions Gen2 (asia-south1) + PWA.
> **Status**: ~95% built. 1 production-blocker + ~12 correctness fixes + verification pass.
>
> **Your job**: Read this brief end-to-end. For each item marked ❌ or ⚠️, implement/fix. For each ✅, do not touch unless a fix explicitly requires it. Do not refactor. Do not redesign. Do not add features beyond this list.

---

## 0. NON-NEGOTIABLE GROUND RULES

1. **Verify before "fixing"** — read the current code first. If already correct, skip.
2. **No new features.** Strictly scope to this document.
3. **No new markdown files.** No change-logs, no inline "fixed by AI" comments.
4. **All edits must compile** (`tsc --noEmit`) and lint clean.
5. **All client writes for `leads`, `statusUpdates`, `reminders`, `teams`, `users`, `tenantConfig`, `leadAssignments`, `usernameIndex` MUST go through Cloud Functions**, never direct Firestore writes from client.
6. **Idempotency**: every trigger and bulk operation guards via `_processedEvents/{eventId}` (72h TTL).
7. **Region**: all CFs in `asia-south1`. All schedulers use `timeZone: 'Asia/Kolkata'`.
8. **Custom claims first**: RBAC reads `request.auth.token.{role,tenantId,teamId}`; Firestore user doc is fallback only.

---

## 1. ROLES — what each role can do

There are exactly 4 roles. Manager has IDENTICAL powers to Admin (often called "Admin or Manager" in code).

### 1.1 `SUPER_ADMIN` — system operator (Samhitha tech team)
- **Status**: ✅ Implemented (`SuperAdminDashboard.tsx`)
- **Capabilities**: create/update/deactivate tenants (colleges), seed initial COLLEGE_ADMIN, view cross-tenant stats.
- **Sees**: all tenants, all data.
- **Cloud Functions allowed**: `adminCreateTenant`, `adminUpdateTenant`, `syncClaims`, plus everything Admin can do.
- **Verify**:
  - [ ] [src/components/SuperAdminDashboard.tsx](src/components/SuperAdminDashboard.tsx) shows tenants list, has "Create College" form.
  - [ ] Cannot accidentally see another tenant's data unless explicitly switched.
  - [ ] `firestore.rules` `isSuperAdmin()` helper bypasses tenant scoping.

### 1.2 `COLLEGE_ADMIN` — college's primary admin
- **Status**: ✅ Implemented (uses `AdminDashboard.tsx`)
- **Capabilities**: full control of own tenant — manage divisions, teams, PROs, leads, reminders, tenantConfig, reports.
- **Sees**: all data within own tenant.
- **Verify**:
  - [ ] Can create/edit/deactivate other Admins, Managers, PROs (but not SUPER_ADMIN).
  - [ ] Cannot see other tenants.

### 1.3 `MANAGER` — identical to Admin
- **Status**: ⚠️ **VERIFY parity** (uses same `AdminDashboard.tsx`)
- **Capabilities**: identical to COLLEGE_ADMIN within own tenant.
- **Critical fix to verify** (see §F11):
  ```powershell
  Get-ChildItem -Recurse src -Include *.ts,*.tsx | `
    Select-String -Pattern "role\s*[!=]==?\s*['""]COLLEGE_ADMIN['""]"
  ```
  Every match must be replaced with `isAdminOrManager(user)` helper. Same audit on `functions/src/`.
- **Verify**: log in as MANAGER → every Admin tab/button/action works identically.

### 1.4 `PRO` (Public Relations Officer) — field worker
- **Status**: ✅ Implemented (`PRODashboard.tsx`)
- **Capabilities**:
  - See ONLY leads where `uid in leadAssignments.assignedPROUids`.
  - Log status updates (with mandatory GPS for DOORSTEP/WALK_IN).
  - Set reminders for own leads.
  - Cannot create new leads (Admin/Manager/Bulk import only).
  - Cannot reassign leads.
  - Cannot edit tenantConfig.
- **Belongs to a Team** (1–2 PROs per team). Team is assigned to one or more Divisions.
- **Verify**:
  - [ ] PRO Firestore rule: `(isPRO() && request.auth.uid in resource.data.assignedPROUids)`.
  - [ ] PRO cannot call `createLead`, `manageTeam`, `updateTenantConfig`, `bulkCreateLeads`, `reassignLeadTeam`, `bulkReassignLeads` (CF guards reject).

---

## 2. DATA SCHEMAS — Firestore collections

Status legend: ✅ Done correctly | ⚠️ Has issue | ❌ Missing.

### 2.1 `tenants/{tenantId}` ✅
```ts
{
  id, name, status: 'ACTIVE' | 'SUSPENDED',
  fcmDevices: [{ deviceId, token, userAgent, platform, isActive, lastActive, registeredAt }],
  createdAt, updatedAt, createdByUid
}
```

### 2.2 `users/{uid}` ✅
```ts
{
  uid, email, username (lowercase), displayName, phone?,
  tenantId, role: 'SUPER_ADMIN' | 'COLLEGE_ADMIN' | 'MANAGER' | 'PRO',
  teamId?, assignedDivisionIds: string[],
  active: boolean,
  fcmDevices: [...same shape as tenants...],
  createdAt, updatedAt, createdByUid
}
```

### 2.3 `usernameIndex/{tenantId}__{username}` ⚠️ **HAS BUG — see §F1**
```ts
{ uid, email, tenantId, username (lowercase), createdAt }
```
- Bug: `adminCreateTenant` (~heavy-apis.ts:L1240) writes WITHOUT `username` field.
- Bug: rules currently allow public read → leaks emails. Fix to CF-only.

### 2.4 `divisions/{divisionId}` ✅ (renamed from `areas`)
```ts
{ id, tenantId, name, code, active, createdAt, updatedAt }
```

### 2.5 `teams/{teamId}` ✅
```ts
{
  id, tenantId, name,
  memberUids: string[],   // 1–2 PROs enforced server-side
  divisionIds: string[],
  active, createdAt, updatedAt
}
```

### 2.6 `leads/{leadId}` ✅
```ts
{
  id, tenantId,
  uniqueLeadId,                 // admin-supplied; UNIQUE per tenant
  uniqueLeadId_lowercase,
  parentName, parentName_lowercase,
  studentName, studentName_lowercase,
  parentPhone, studentPhone,    // both 10-digit normalized via cleanPhoneStr()
  intermediateGroup,            // code from tenantConfig.intermediateGroups
  address, sourceCity,
  divisionId, divisionName,     // denormalized
  sourceImportBatchId?,
  teamId, assignedPROUids: string[],
  lastStatusCode?, lastStatusLabel?, lastStatusAt?,
  lastApproachType?, lastUpdatedByUid?, lastUpdatedByTeamId?,
  nextFollowupAt?, nextFollowupReminderId?,
  joinedCollegeName?,           // populated when terminal status = JOINED_*
  active: boolean,              // soft-delete
  createdAt, updatedAt, createdByUid
}
```

### 2.7 `leads/{leadId}/statusUpdates/{updateId}` ✅ (append-only subcollection)
```ts
{
  id, tenantId, leadId,
  approachType: 'PHONE' | 'DOORSTEP' | 'WALK_IN' | 'ONLINE',  // HARDCODED
  statusCode, statusLabel,      // denormalized at write
  parentPhone, studentPhone,    // snapshot at time of update
  intermediateGroup, joinedCollegeName?,
  comments,
  loggedByUid, loggedByName,
  accompanyingMemberUid?, accompanyingMemberName?,
  teamId,
  gpsLocation?: { lat, lng, accuracyMeters, capturedAt },
  gpsRequired: boolean,         // true for DOORSTEP/WALK_IN
  gpsCaptured: boolean,
  nextFollowupReminderId?,
  createdAt
}
```
- Rule: `allow update, delete: if false` (immutable history).

### 2.8 `leadAssignments/{tenantId}__{leadId}` ✅ (denormalized search index)
```ts
{
  tenantId, leadId,
  teamId, assignedPROUids: string[],
  divisionId, divisionName,
  parentName, parentName_lowercase,
  studentName, studentName_lowercase,
  uniqueLeadId, uniqueLeadId_lowercase,
  parentPhone, studentPhone,
  lastStatusCode?, nextFollowupAt?,
  active, updatedAt
}
```
- Maintained by `onLeadCreated/Updated/Deleted` triggers and `onTeamUpdated`.
- Used for instant `onSnapshot` filtered queries on PRO/Admin lists.

### 2.9 `reminders/{reminderId}` ✅
```ts
{
  id, tenantId, leadId,
  leadDisplayName, uniqueLeadId,   // denorm for notification body
  dueAt: Timestamp,
  dueDateOnly: boolean,            // true → fires 9 AM IST that day
  note,
  createdByUid, createdByName,
  recipientUids: string[],         // computed at create: teammates + ALL admins + ALL managers
  status: 'PENDING' | 'SENT' | 'COMPLETED' | 'SNOOZED' | 'CANCELLED',
  snoozedFromReminderId?,
  completedByUid?, completedAt?,
  sentAt?,
  createdAt, updatedAt
}
```

### 2.10 `tenantConfig/{tenantId}` ✅
```ts
{
  tenantId,
  statusOptions: [{ code, label, color, isTerminal, order, active }],
  intermediateGroups: [{ code, label, order, active }],
  joinedCollegeOptions: [{ code, label, order, active }],
  updatedAt, updatedByUid?
}
```
- Approach types are HARDCODED (not in tenantConfig).

### 2.11 `importBatches/{batchId}` ✅
```ts
{
  id, tenantId, sourceFilename,
  uploadedByUid, totalRows, successRows, errorRows,
  errors: [{ row, uniqueLeadId?, reason }],   // capped at 100
  createdAt, completedAt
}
```

### 2.12 `tenant_stats/{tenantId}` & `tenant_daily_stats/{tenantId}__{YYYY-MM-DD}` ✅
- Maintained by triggers. Read-only client side.

### 2.13 `_processedEvents/{eventId}` ✅
- Idempotency markers, 72h TTL via `cleanupStaleReminders` or separate cleanup.
- CF-only.

---

## 3. FIRESTORE INDEXES (`firestore.indexes.json`) ✅

All 11 required + 3 bonus present:
1. `leadAssignments` (tenantId + assignedPROUids array-contains + active)
2. `leadAssignments` (tenantId + divisionId + active)
3. `leadAssignments` (tenantId + teamId + active)
4. `leads` (tenantId + divisionId + lastStatusCode)
5. `leads` (tenantId + uniqueLeadId)
6. `leads` (tenantId + nextFollowupAt)
7. `reminders` (tenantId + status + dueAt)
8. `reminders` (recipientUids array-contains + dueAt)
9. `statusUpdates` collection-group (tenantId + createdAt desc)
10. `statusUpdates` collection-group (tenantId + loggedByUid + createdAt desc)
11. `users` (tenantId + role + active)

**Action**: `firebase deploy --only firestore:indexes` — wait 5–30 min for build before E2E.

---

## 4. FIRESTORE SECURITY RULES (`firestore.rules`) ⚠️

### 4.1 Helpers (all present) ✅
`tenantId()`, `role()`, `isSuperAdmin()`, `isAdminOrManager()`, `isPRO()`, `sameTenant(t)`, `isAuthenticated()`.

### 4.2 Per-collection — current state
| Collection | Read | Write | Status |
|---|---|---|---|
| tenants | authenticated | SuperAdmin only | ✅ |
| users | self / Admin+Mgr same tenant / SA | self bootstrap, Admin+Mgr | ✅ |
| **usernameIndex** | **public TRUE** | denied | ⚠️ **FIX: change to CF-only** (see §F1) |
| divisions | same tenant | CF only | ✅ |
| teams | same tenant | CF only | ✅ |
| leads | Admin+Mgr OR (PRO && uid in assignedPROUids) | CF only | ✅ |
| statusUpdates (subcoll) | same as leads | CF only, append-only | ✅ |
| leadAssignments | Admin+Mgr OR (PRO && uid in assignedPROUids) | CF only | ✅ |
| reminders | Admin+Mgr OR uid in recipientUids | CF only | ✅ |
| tenantConfig | authenticated | Admin+Mgr same tenant | ✅ |
| importBatches | Admin+Mgr same tenant | CF only | ✅ |
| tenant_stats / daily | same tenant or SA | triggers only | ✅ |
| _processedEvents | denied | CF only | ✅ |

### 4.3 Required fix
```
match /usernameIndex/{key} {
  allow read, write: if false;
}
```

### 4.4 Verify
- `users` write rule must reject cross-tenant moves: `request.resource.data.tenantId == resource.data.tenantId`.
- `users` role-change must require `isAdminOrManager()`.

---

## 5. CLOUD FUNCTIONS

### 5.1 `criticalApi` (Gen2 onCall, asia-south1, 512MiB, concurrency=80) ✅

Action router in [functions/src/critical-api.ts](functions/src/critical-api.ts), handlers in [functions/src/heavy-apis.ts](functions/src/heavy-apis.ts).

| Action | Status | Caller roles | Notes |
|---|---|---|---|
| createUser | ✅ | Admin+Mgr, SA | Creates Auth user + user doc + usernameIndex (transaction). Sets custom claims. |
| updateUser | ✅ | Admin+Mgr, SA, self (limited) | Atomic username swap (delete old index, create new). |
| deactivateUser | ✅ | Admin+Mgr, SA | Soft-delete user; revoke session. |
| manageTeam | ✅ | Admin+Mgr | Enforces 1–2 members. Triggers `onTeamUpdated` cascade. |
| createLead | ✅ | Admin+Mgr | Validates uniqueLeadId; resolves division→team→PROs. |
| bulkCreateLeads | ✅ | Admin+Mgr | Rate-limited 1/min; chunks 400; idempotent on uniqueLeadId. |
| updateLead | ✅ | Admin+Mgr | Soft-delete via `active=false`. |
| reassignLeadTeam | ✅ | Admin+Mgr | Single lead reassign. |
| bulkReassignLeads | ✅ | Admin+Mgr | Bulk reassign by division change. |
| syncLeadAssignments | ✅ | Admin+Mgr, SA | One-time backfill helper. |
| logStatusUpdate | ✅ | PRO+ | GPS validation; auto-completes prior PENDING reminder. |
| manageReminder | ✅ | PRO+ | create/snooze/complete/cancel/update; computes recipientUids. |
| updateTenantConfig | ✅ | Admin+Mgr | statusOptions/intermediateGroups/joinedCollegeOptions. |
| generateReport | ✅ | Admin+Mgr, SA | Aggregations for ReportsPanel. |
| getDashboardStats | ✅ | All authenticated | Role-scoped stats. |
| adminCreateTenant | ⚠️ | SA | **Bug**: usernameIndex write missing `username` field — see §F1. |
| adminUpdateTenant | ✅ | SA | |
| syncClaims | ✅ | Admin+Mgr, SA | Backfill custom claims for users missing them. |
| **`resolveUsernameToEmail`** | ❌ | **UNAUTHENTICATED** | **MISSING — must add (F1).** Rate-limited; returns email by username (single-tenant) or {tenantId, username} pair. |

### 5.2 `notificationApi` (Gen2 onCall, 256MiB) ✅

In [functions/src/notification-api.ts](functions/src/notification-api.ts) and [functions/src/notification-handlers.ts](functions/src/notification-handlers.ts).

| Action | Status | Notes |
|---|---|---|
| registerFcmToken | ✅ | Writes to user doc + tenant doc (if Admin/Mgr). Dedup by deviceId. |
| unregisterFcmToken | ⚠️ | **VERIFY**: must remove single device by deviceId, NOT mark all inactive. |
| markNotificationRead | ✅ | |
| sendStatusUpdateNotification | ✅ | Called by `onStatusUpdateCreated` trigger. |
| sendReminderPush | ✅ | Called by reminder schedulers. |

### 5.3 Scheduled Functions ✅

In [functions/src/scheduled-jobs.ts](functions/src/scheduled-jobs.ts), all use `.timeZone('Asia/Kolkata')`.

| Function | Schedule | Purpose |
|---|---|---|
| processReminders | every 5 minutes | Picks `status=PENDING && dueDateOnly=false && dueAt<=now`; sends FCM; sets SENT. |
| processDailyReminders | `0 9 * * *` | Picks `status=PENDING && dueDateOnly=true && dueAt<=startOfTodayIST`; sends FCM. |
| cleanupStaleReminders | daily 2 AM | Removes old SENT/COMPLETED/CANCELLED past 90 days; cleans `_processedEvents` past 72h. |

### 5.4 Firestore Triggers ✅

In [functions/src/stats-triggers.ts](functions/src/stats-triggers.ts).

| Trigger | Status | Purpose |
|---|---|---|
| onLeadCreated | ✅ | Creates `leadAssignments` doc with denorm fields; increments tenant_stats. |
| onLeadUpdated | ✅ | Syncs changed denorm fields to leadAssignments; idempotent via _processedEvents. |
| onLeadDeleted | ✅ | Deletes leadAssignment; decrements stats. |
| onStatusUpdateCreated | ✅ | Updates parent lead's lastStatus*; triggers FCM; auto-completes prior PENDING reminder. |
| onTeamUpdated | ⚠️ | **VERIFY**: cascades teamId+memberUids to all leadAssignments for team's divisions. Idempotent. |
| onTeamDeleted | ✅ | Marks team inactive; clears teamId on leadAssignments. |
| onReminderCreated | ✅ | Denorms `nextFollowupAt` to lead + leadAssignment. |
| onReminderStatusChanged | ✅ | Updates `nextFollowupAt` cascade. |
| onUserUpdated | ✅ | Re-syncs custom claims when role/teamId changes. |

### 5.5 Helpers in [functions/src/utils.ts](functions/src/utils.ts) ✅
- `verifyAuthToken(context)`, `requireAdminOrManager`, `requireSuperAdmin`, `requirePROOrAbove`
- `cleanPhoneStr(phone)` — normalizes to 10 digits, strips `91` prefix
- `checkRateLimit(key, max, windowMs)`
- `isAlreadyProcessed(eventId)` — 72h TTL via `_processedEvents`
- `commitInChunks(ops, 400)`
- `validateUsername`, `validateUniqueLeadId`
- `buildLeadAssignmentSearchFields(lead)` — returns lowercase search fields

---

## 6. CLIENT — components and key files

### 6.1 Removed from pHLynk ✅
CollectPaymentForm, RetailerDashboard, OTPVerification, src/app/retailer/, fast2sms libs, payment/cheque/UPI/OTP-payment, delivery components.

### 6.2 Renamed ✅
- LineWorkerDashboard → [PRODashboard.tsx](src/components/PRODashboard.tsx)
- WholesalerAdminDashboard → [AdminDashboard.tsx](src/components/AdminDashboard.tsx)
- retailer-profile-service → lead-profile-service

### 6.3 New components ✅
[LoginForm](src/components/auth/LoginForm.tsx), [TeamsManagement](src/components/teams/TeamsManagement.tsx), [LeadsListView](src/components/leads/LeadsListView.tsx), [LeadDetailView](src/components/leads/LeadDetailView.tsx), [LogStatusUpdateForm](src/components/leads/LogStatusUpdateForm.tsx), [BulkImportLeads](src/components/leads/BulkImportLeads.tsx), [AddLeadForm](src/components/leads/AddLeadForm.tsx), [DivisionsManagement](src/components/divisions/DivisionsManagement.tsx), [RemindersWidget](src/components/reminders/RemindersWidget.tsx), [SetReminderDialog](src/components/reminders/SetReminderDialog.tsx), [TenantConfigManagement](src/components/config/TenantConfigManagement.tsx), [ReportsPanel](src/components/reports/ReportsPanel.tsx).

### 6.4 New libs ✅
- [src/lib/lead-id-utils.ts](src/lib/lead-id-utils.ts) — `validateUniqueLeadId`
- [src/lib/xlsx-import.ts](src/lib/xlsx-import.ts) — column auto-mapping with fuzzy matching
- [src/lib/gps-capture.ts](src/lib/gps-capture.ts) — `captureGPS({required:bool})`

### 6.5 Kept unchanged from pHLynk ✅ (do not touch)
[src/lib/firebase.ts](src/lib/firebase.ts) (`initializeFirestore` + `persistentLocalCache`), [src/contexts/ConnectivityContext.tsx](src/contexts/ConnectivityContext.tsx), [src/hooks/useOfflineGuard.ts](src/hooks/useOfflineGuard.ts), [src/components/OfflineBanner.tsx](src/components/OfflineBanner.tsx), [src/lib/fcm.ts](src/lib/fcm.ts), [src/lib/device-manager.ts](src/lib/device-manager.ts).

### 6.6 [src/lib/cloud-functions.ts](src/lib/cloud-functions.ts) ⚠️
Action sets present and correct. **MUST add** `'resolveUsernameToEmail'` after F1.

---

## 7. PWA ✅

- [public/manifest.json](public/manifest.json) — branded "Samhitha Admissions"
- [public/sw.js](public/sw.js) — single unified SW (PWA cache + FCM background)
- IndexedDB DB: `samhitha-sw-auth`
- Reminder notification action buttons: `Open Lead`, `Snooze 1h`, `Mark Done`
- ⚠️ **Verify** `notificationclick` handler routes `snooze`/`done` through CF (not direct Firestore write).
- ⚠️ Cache headers in [next.config.ts](next.config.ts) for `/sw.js` + `/manifest.json` = `no-cache, no-store, must-revalidate, max-age=0`.

---

## 8. SCRIPTS ✅
[scripts/seed-initial-tenant.js](scripts/seed-initial-tenant.js), [scripts/seed-tenant-config.js](scripts/seed-tenant-config.js), [scripts/seed-leads.js](scripts/seed-leads.js), [scripts/set-custom-claims.js](scripts/set-custom-claims.js).
- ❌ **Add**: `scripts/backfill-username-field.js` (see F1 step 3).

---

## 9. THE ACTUAL FIX LIST

### 🔴 TIER 1 — PRODUCTION BLOCKER

#### F1. Username login is broken — replace with server-side resolver

**Symptom**: client queries `usernameIndex where username == X`, but:
- `adminCreateTenant` (heavy-apis.ts:~L1240) writes super-admin index doc WITHOUT `username` field.
- No tenantId scoping.
- Fallback path is incomplete.
- `usernameIndex` is publicly readable → leaks every user's email.

**Fix**:

**Step 1** — Add CF action `resolveUsernameToEmail` to [functions/src/critical-api.ts](functions/src/critical-api.ts) HANDLERS map and implement in [functions/src/heavy-apis.ts](functions/src/heavy-apis.ts):
```ts
export async function resolveUsernameToEmailHandler(payload: any, _context: any) {
  const { username, tenantId } = payload;
  if (!username || typeof username !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid request');
  }
  const u = username.toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(u) || u.includes('__')) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }
  await checkRateLimit(`resolveUsername:${u}`, 10, 60_000);

  if (tenantId) {
    const snap = await db.doc(`usernameIndex/${tenantId}__${u}`).get();
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'User not found');
    return { email: snap.data()!.email };
  }
  const q = await db.collection('usernameIndex').where('username', '==', u).limit(2).get();
  if (q.empty) throw new functions.https.HttpsError('not-found', 'User not found');
  if (q.size > 1) throw new functions.https.HttpsError('failed-precondition', 'Tenant required');
  return { email: q.docs[0].data().email };
}
```
Make it callable WITHOUT auth: either expose as a separate `onCall({ region:'asia-south1' })` named export OR allow it specifically in `criticalApi` router (skip auth check for this single action).

**Step 2** — Fix `adminCreateTenant` in [functions/src/heavy-apis.ts](functions/src/heavy-apis.ts) (~L1240):
```ts
await db.collection('usernameIndex').doc(`${tenantId}__${username}`).set({
  uid, email: adminEmail, tenantId,
  username: username.toLowerCase(),   // ← ADD THIS
  createdAt: now,
});
```

**Step 3** — Create [scripts/backfill-username-field.js](scripts/backfill-username-field.js):
- Iterate all `usernameIndex` docs.
- If `username` field missing → derive from doc-id suffix (split on `__`).
- Write back via `set({ username }, { merge: true })`.

**Step 4** — Replace client login in [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) `login()`:
```ts
const login = useCallback(async (emailOrUsername: string, password: string) => {
  setLoading(true);
  try {
    let email = emailOrUsername.trim();
    if (!email.includes('@')) {
      const result = await callCloudFunction('resolveUsernameToEmail', {
        username: email.toLowerCase(),
      });
      if (!result?.email) throw new Error('Invalid credentials');
      email = result.email;
    }
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    throw new Error('Invalid credentials');   // generic, no enumeration
  } finally {
    setLoading(false);
  }
}, []);
```
Delete the old `getDocs(usernameQuery)` block and the dynamic firestore import.

**Step 5** — Add `'resolveUsernameToEmail'` to `CRITICAL_ACTIONS` in [src/lib/cloud-functions.ts](src/lib/cloud-functions.ts).

**Step 6** — Lock down rules in [firestore.rules](firestore.rules):
```
match /usernameIndex/{key} {
  allow read, write: if false;
}
```

**Step 7** — Verify:
- New user via Admin UI → log in by username → succeeds.
- Log in by email → succeeds.
- Wrong creds → "Invalid credentials".
- Browser console `getDocs(collection(db,'usernameIndex'))` → permission denied.

---

### 🟡 TIER 2 — CORRECTNESS BUGS

| ID | File | Fix |
|---|---|---|
| F2 | heavy-apis.ts adminCreateTenant | (covered in F1 step 2) |
| F3 | AuthContext.tsx | Delete dead `getDocs(usernameQuery)` block after F1 |
| F4 | notification-handlers.ts `unregisterFcmToken` | Verify removes ONLY current `deviceId`, not `markAllInactive`; updates BOTH user doc AND tenant doc |
| F5 | AuthContext.tsx `logout` | Verify order: unregisterFcm → IndexedDB false → SW postMessage → firebaseSignOut → localStorage.clear → unregister all SWs → clear all caches → window.location.replace('/') |
| F6 | public/sw.js notificationclick | `snooze`/`done` actions MUST POST to CF (not direct Firestore). `open` does `clients.openWindow`. All call `event.notification.close()`. Get auth token from IndexedDB or message client. |
| F7 | gps-capture.ts + LogStatusUpdateForm | If `accuracyMeters > 100` → show warning toast "GPS ±Xm — proceed?"; non-blocking |
| F8 | bulkCreateLeadsHandler + BulkImportLeads | Verify `mode: 'skip' \| 'error'` (default skip); UI exposes radio; per-row errors include row+uniqueLeadId+reason |
| F9 | manageReminderHandler snooze branch | Old reminder → `status='SNOOZED'`; new reminder → `snoozedFromReminderId: oldId`; both in transaction |
| F10 | onTeamUpdated trigger | When memberUids changes → cascade `assignedPROUids` to all `leadAssignments where teamId==X` AND parent leads. When divisionIds changes → re-assign teamId on division's leads. Idempotency guard `_processedEvents/{event.id}`. |
| F11 | (entire src/ + functions/src/) | Search for `role === 'COLLEGE_ADMIN'` standalone → replace with `isAdminOrManager(user)` helper. Create `src/lib/role-utils.ts` if missing. CRITICAL for Manager parity. |
| F12 | functions/src/index.ts | Verify all 9 triggers + 3 schedulers + 2 onCall routers exported. Add any missing. |
| F13 | functions/lib/ | Stale `lib/src/...` and `lib/...` double-nesting. Run `cd functions; npm run build`. Confirm single tree. |

---

### 🟢 TIER 3 — VERIFICATION SWEEP (read-only; fix only if broken)

| ID | What to verify |
|---|---|
| V1 | firestore.rules: all helpers present; users-write rejects cross-tenant; role change requires Admin+Mgr; usernameIndex CF-only after F1 |
| V2 | firestore.indexes.json: all 11 required indexes; deploy and wait |
| V3 | Every CF action handler calls verifyAuthToken → role guard → tenant scope (except SA bypass and resolveUsername) |
| V4 | processReminders: queries `dueDateOnly==false && dueAt<=now`; limits 200/run; sets SENT only on success |
| V5 | processDailyReminders: queries `dueDateOnly==true && dueAt<=startOfTodayIST`; cron `0 9 * * *` IST |
| V6 | onStatusUpdateCreated: auto-completes max 5 PENDING reminders for lead; ignores the new `nextFollowupReminderId` if set |
| V7 | sendReminderPush + sendStatusUpdateNotification: dedup tokens; filter `isActive && lastActive>30d`; on `registration-token-not-registered` → mark inactive; chunk 500 |
| V8 | updateLead with `active=false`: leads → false; cascades to leadAssignments; PRO query filters out |
| V9 | Reassign UI shows confirm dialog with affected count |
| V10 | LeadDetailView has NO edit/delete on individual statusUpdates |
| V11 | All PWA icons (72/96/144/192/384/512) present in public/ |
| V12 | next.config.ts: /sw.js + /manifest.json have no-cache headers |
| V13 | .env.local.example has all NEXT_PUBLIC_FIREBASE_* + NEXT_PUBLIC_FCM_VAPID_KEY; no Fast2SMS vars |
| V14 | npm ls fast2sms (and grep for socket.io, twilio) → none |
| V15 | Grep src,functions/src,scripts,public for `retailer\|wholesaler\|lineworker\|payment\|cheque\|fast2sms\|delivery\|pharmalync` → all are deletable comments or removed |
| V16 | tsconfig strict:true on both root and functions |
| V17 | `npm run lint` and `cd functions; npm run lint` → clean |
| V18 | `npx tsc --noEmit` on both → clean |

---

### 🚀 TIER 4 — DEPLOYMENT & E2E

#### D1. Deploy order
```powershell
cd C:\Users\aviS\Downloads\samhitha_track
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes        # wait for build
cd functions; npm run build; cd ..
firebase deploy --only functions
npm run build
firebase deploy --only hosting                  # OR netlify
```

#### D2. Initial seed (in order)
```powershell
node scripts/seed-initial-tenant.js
node scripts/seed-tenant-config.js --tenant=<tid>
node scripts/set-custom-claims.js --tenant=<tid>
node scripts/backfill-username-field.js          # NEW from F1
```

#### D3. E2E smoke (must pass all)
1. Username login → succeeds.
2. Email login → succeeds.
3. Wrong creds → generic "Invalid credentials".
4. Admin creates 2 PROs + 1 Team → both PROs see same lead list.
5. Bulk import 100 leads → all land with denorm fields.
6. PRO logs DOORSTEP, denies GPS → BLOCKED.
7. PRO logs PHONE without GPS → succeeds.
8. PRO sets reminder for "in 6 minutes" → at 5–10 min mark, FCM fires to BOTH teammates + ALL admins + ALL managers.
9. PRO sets date-only reminder for tomorrow → at 9 AM IST, FCM fires.
10. **MANAGER login → identical UI to Admin** (every tab/button accessible).
11. Offline log update → toast queued → reconnect → admin sees update.
12. Lighthouse PWA score ≥ 90.
13. Install on Android Chrome → background FCM works after closing.
14. Soft-delete a lead → disappears from PRO list, visible in Admin "Inactive" filter.
15. Reassign division to another team → confirmation → cascade applies.
16. Snooze a reminder via SW notification action → old SNOOZED, new PENDING with snoozedFromReminderId.
17. Mark reminder Done via SW action → COMPLETED.
18. Status update auto-completes pending reminder for that lead.
19. SUPER_ADMIN can create new tenant + bootstrap COLLEGE_ADMIN logs in successfully.

#### D4. Production guardrails
- Firebase Auth password policy: min 8 chars + 1 number.
- App Check enabled for Firestore + Functions.
- GCP budget alert.
- Cloud Logging exclusion for noisy `_processedEvents` reads.

---

## 10. OUT OF SCOPE — DO NOT DO

- ❌ SMS/WhatsApp to parents.
- ❌ Payment / fees collection.
- ❌ UI redesign or theme overhaul.
- ❌ Framework migration.
- ❌ New unit-test framework (existing playwright is fine).
- ❌ Touching `firebase.ts`, `ConnectivityContext`, `useOfflineGuard`, `OfflineBanner` unless a Tier 1/2 fix requires.
- ❌ Adding any `.md` documentation file.

---

## 11. EFFORT ESTIMATE

| Tier | Items | Effort |
|---|---|---|
| Tier 1 (blocker) | F1 | 2–4 hrs |
| Tier 2 (correctness) | F2–F13 | ~1 day |
| Tier 3 (verification) | V1–V18 | ~1 day |
| Tier 4 (deploy + E2E) | D1–D4 | ~1 day |
| **Total** | | **2.5–4 days** |

---

## 12. DELIVERABLE CHECKLIST

When you (the agent) report "done":
- [ ] F1 fully implemented (CF + client + rules + backfill + tested manually).
- [ ] All Tier 2 items either fixed or marked verified-no-fix-needed (with file:line evidence).
- [ ] All Tier 3 verifications pass (paste command outputs).
- [ ] `npm run build` and `cd functions; npm run build` both succeed with zero errors.
- [ ] All 19 E2E flows pass on staging.
- [ ] Lighthouse PWA ≥ 90.
- [ ] Firestore indexes show "Enabled" (not "Building").
- [ ] No browser console errors on any role's dashboard.
- [ ] FCM background notification verified on a real Android device.

When all checked → production-ready.
