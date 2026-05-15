'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import Image from 'next/image';
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Super Admin Bootstrap Page (/init)
 *
 * This is the FIRST-RUN setup page. It creates:
 * 1. The tenant document (Samhitha College)
 * 2. The first SUPER_ADMIN Firebase Auth account
 * 3. The user document in Firestore with SUPER_ADMIN role
 * 4. The usernameIndex entry
 * 5. The default tenantConfig
 *
 * Works WITHOUT cloud functions — uses client SDK directly.
 * Guarded by a secret code to prevent unauthorized access.
 *
 * Once the first SUPER_ADMIN exists, this page should be disabled
 * (or the INIT_SECRET env var removed) in production.
 */

// Default status options for tenant config
const DEFAULT_STATUS_OPTIONS = [
  { code: 'WAITING_EAMCET', label: 'Waiting EAMCET', color: '#3b82f6', isTerminal: false, order: 1, active: true },
  { code: 'WAITING_NEET', label: 'Waiting NEET', color: '#8b5cf6', isTerminal: false, order: 2, active: true },
  { code: 'WILLING_DEGREE', label: 'Willing Degree', color: '#22c55e', isTerminal: false, order: 3, active: true },
  { code: 'NOT_INTERESTED_DEGREE', label: 'Not Interested Degree', color: '#ef4444', isTerminal: false, order: 4, active: true },
  { code: 'WILLING_SAMHITHA', label: 'Willing Samhitha', color: '#10b981', isTerminal: false, order: 5, active: true },
  { code: 'WILLING_OTHER_COLLEGE', label: 'Willing Other College', color: '#f59e0b', isTerminal: false, order: 6, active: true },
  { code: 'JOINED_SAMHITHA', label: 'Joined Samhitha', color: '#16a34a', isTerminal: true, order: 7, active: true },
  { code: 'JOINED_OTHER', label: 'Joined Other', color: '#f97316', isTerminal: true, order: 8, active: true },
  { code: 'NOT_INTERESTED_SAMHITHA', label: 'Not Interested Samhitha', color: '#dc2626', isTerminal: true, order: 9, active: true },
  { code: 'NOT_DECIDED', label: 'Not Decided', color: '#6b7280', isTerminal: false, order: 10, active: true },
  { code: 'PHONE_UNREACHABLE', label: 'Phone Unreachable', color: '#9ca3af', isTerminal: false, order: 11, active: true },
  { code: 'NOT_ANSWERING', label: 'Not Answering', color: '#78716c', isTerminal: false, order: 12, active: true },
  { code: 'REVISIT_NEEDED', label: 'Revisit Needed', color: '#fb923c', isTerminal: false, order: 13, active: true },
];

const DEFAULT_INTERMEDIATE_GROUPS = [
  { code: 'MPC', label: 'MPC', order: 1, active: true },
  { code: 'BIPC', label: 'BiPC', order: 2, active: true },
  { code: 'CEC', label: 'CEC', order: 3, active: true },
  { code: 'MEC', label: 'MEC', order: 4, active: true },
  { code: 'OTHERS', label: 'Others', order: 5, active: true },
];

const DEFAULT_JOINED_COLLEGE_OPTIONS = [
  { code: 'SAMHITHA', label: 'Samhitha College', order: 1, active: true },
  { code: 'OTHERS', label: 'Others', order: 2, active: true },
];

// The secret code — change this before deployment!
// In production, use an env var or remove this page after setup
const INIT_SECRET = 'samhitha2025';

export default function InitPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    username: '',
    phone: '',
    secretCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [step, setStep] = useState<string>('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    // Validate secret code
    if (formData.secretCode !== INIT_SECRET) {
      setResult({ success: false, message: 'Invalid secret code. Contact the developer for the initialization code.' });
      setLoading(false);
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setResult({ success: false, message: 'Passwords do not match.' });
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setResult({ success: false, message: 'Password must be at least 6 characters.' });
      setLoading(false);
      return;
    }

    const usernameLower = formData.username.toLowerCase();

    try {
      // ── Step 1: Create Firebase Auth account ────────────────────────────
      console.log('[INIT] Step 1: Creating authentication account...');
      setStep('Creating authentication account...');
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const uid = userCredential.user.uid;
      console.log('[INIT] Step 1 Complete. UID:', uid);

      // Get a fresh ID token for REST API calls.
      const idToken = await userCredential.user.getIdToken();

      // ── Firestore REST API setup ────────────────────────────────────────
      // Bypass the Firestore client SDK entirely (its WebChannel transport
      // hangs on this network). Plain HTTPS + Bearer token = same path Auth
      // uses, which we know works.
      const projectId = 'samhitaadmissiontracker';
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

      // Convert plain JS values to Firestore REST "Value" format.
      const toValue = (v: any): any => {
        if (v === null || v === undefined) return { nullValue: null };
        if (typeof v === 'boolean') return { booleanValue: v };
        if (typeof v === 'number') {
          return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        }
        if (typeof v === 'string') return { stringValue: v };
        if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
        if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
        return { stringValue: String(v) };
      };
      const toFields = (obj: Record<string, any>): Record<string, any> => {
        const out: Record<string, any> = {};
        for (const [k, val] of Object.entries(obj)) out[k] = toValue(val);
        return out;
      };

      // PATCH = create-or-overwrite at the given document path.
      const writeDoc = async (path: string, data: Record<string, any>, op: string) => {
        console.log(`[INIT] Writing ${path}...`);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          const res = await fetch(`${baseUrl}/${path}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fields: toFields(data) }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`${op} failed (${res.status}): ${errBody}`);
          }
          console.log(`[INIT] Wrote ${path} OK.`);
        } catch (e: any) {
          if (e.name === 'AbortError') {
            throw new Error(`${op} timed out after 20 s. Check internet/firewall.`);
          }
          throw e;
        } finally {
          clearTimeout(timer);
        }
      };

      // ISO timestamp instead of serverTimestamp() — the REST shape for
      // server-generated timestamps requires field transforms which add
      // complexity for no real benefit on this one-time bootstrap.
      const now = new Date().toISOString();

      try {
        const tenantId = 'samhitha-college';

        // Step 2: Tenant document
        setStep('Creating tenant...');
        await writeDoc(`tenants/${tenantId}`, {
          name: 'Samhitha College',
          type: 'COLLEGE',
          status: 'ACTIVE',
          fcmDevices: [],
          createdAt: now,
          updatedAt: now,
        }, 'creating tenant');

        // Step 3: SUPER_ADMIN user document
        setStep('Setting up SUPER_ADMIN profile...');
        await writeDoc(`users/${uid}`, {
          tenantId: null,
          email: formData.email,
          username: usernameLower,
          displayName: formData.displayName,
          phone: formData.phone || null,
          role: 'SUPER_ADMIN',
          teamId: null,
          assignedDivisionIds: [],
          active: true,
          fcmDevices: [],
          createdAt: now,
          updatedAt: now,
        }, 'setting up admin profile');

        // Step 4: Username index
        setStep('Creating username index...');
        await writeDoc(`usernameIndex/global__${usernameLower}`, {
          uid,
          email: formData.email,
          tenantId: null,
          isGlobalAdmin: true,
          username: usernameLower,
          createdAt: now,
        }, 'creating username index');

        // Step 5: Default tenant config
        setStep('Seeding configuration...');
        await writeDoc(`tenantConfig/${tenantId}`, {
          tenantId,
          statusOptions: DEFAULT_STATUS_OPTIONS,
          intermediateGroups: DEFAULT_INTERMEDIATE_GROUPS,
          joinedCollegeOptions: DEFAULT_JOINED_COLLEGE_OPTIONS,
          updatedAt: now,
        }, 'seeding configuration');

      } catch (firestoreError: any) {
        // Roll back the Auth account so the user can retry cleanly.
        console.warn('[INIT] Firestore write failed; rolling back Auth account...');
        await userCredential.user.delete().catch((e) =>
          console.error('[INIT] Could not roll back Auth account:', e)
        );
        throw firestoreError;
      }

      // Step 6: Sign out so they log in fresh through the login page.
      setStep('Finalizing...');
      await firebaseSignOut(auth);
      console.log('[INIT] All done!');

      setResult({
        success: true,
        message: 'SUPER_ADMIN account created successfully! Redirecting to sign-in…',
      });

      setTimeout(() => { window.location.href = '/login'; }, 3000);

    } catch (error: any) {
      console.error('Init page error:', error);
      let message = 'Failed to create account.';
      if (error.code === 'auth/email-already-in-use') {
        message =
          'This email is already registered. If a previous setup attempt failed, ' +
          'delete the orphaned account in Firebase Console → Authentication, then retry.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.message) {
        message = error.message;
      }
      setResult({ success: false, message });
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-violet-100/30 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-indigo-300/30">
            <Image
              src="/logoMain.png"
              alt="Samhitha"
              width={64}
              height={64}
              className="object-contain w-full h-full"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Initial Setup</h1>
            <p className="text-xs text-indigo-500 font-semibold tracking-[0.2em] uppercase mt-0.5">
              Create Super Admin Account
            </p>
          </div>
          <p className="text-sm text-slate-500">
            This page creates the first SUPER_ADMIN. After setup, you can create admins, managers, and PROs from the dashboard.
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-xl border-indigo-100/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-indigo-600">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Super Admin Registration</span>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-700">Full Name *</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g. Ravi Kumar"
                  className="border-indigo-100 focus:border-indigo-400"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Username *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="lowercase, 3-30 chars"
                  className="border-indigo-100 focus:border-indigo-400"
                  required
                  minLength={3}
                  maxLength={30}
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="superadmin@samhitha.edu"
                  className="border-indigo-100 focus:border-indigo-400"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Phone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="border-indigo-100 focus:border-indigo-400"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Password * (min 6 chars)</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="border-indigo-100 focus:border-indigo-400"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Confirm Password *</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="border-indigo-100 focus:border-indigo-400"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Secret Code *</Label>
                <Input
                  type="password"
                  value={formData.secretCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, secretCode: e.target.value }))}
                  placeholder="Enter the initialization secret"
                  className="border-indigo-100 focus:border-indigo-400"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Contact the developer if you don&apos;t have this code</p>
              </div>

              {result && (
                <Alert variant={result.success ? "default" : "destructive"}>
                  {result.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription className="text-xs">{result.message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-medium shadow-lg shadow-indigo-200/50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {step || 'Creating Account...'}
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Create Super Admin Account
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-[10px] text-slate-400">
            After creating the SUPER_ADMIN, you&apos;ll be redirected to the login page.
          </p>
          <a href="/login" className="text-xs text-indigo-600 hover:text-indigo-700 underline">
            Already have an account? Sign in
          </a>
        </div>
      </div>
    </div>
  );
}
