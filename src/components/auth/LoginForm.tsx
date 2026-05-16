'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, LogIn, KeyRound, User } from 'lucide-react';
import Image from 'next/image';

export function LoginForm() {
  const { login, resetPassword, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // If user is already logged in, redirect them back to dashboard
  React.useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(emailOrUsername, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetEmail) return;
    try {
      await resetPassword(resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    }
  };

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/30">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (showReset) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/30">
        <Card className="w-full max-w-sm shadow-xl border-emerald-100/50 bg-white/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Reset Password</h2>
            <p className="text-xs text-slate-500">We&apos;ll send a reset link to your email</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetSent ? (
              <Alert className="border-emerald-200 bg-emerald-50/50">
                <AlertDescription className="text-xs text-emerald-800">
                  Password reset email sent. Check your inbox.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="your@email.com" className="rounded-xl border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20 bg-slate-50/50" />
                </div>
                <Button onClick={handleReset} className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md" disabled={!resetEmail}>
                  Send Reset Link
                </Button>
              </>
            )}
            <Button variant="link" className="w-full text-xs text-emerald-600 hover:text-emerald-700" onClick={() => setShowReset(false)}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/30 relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-teal-100/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-emerald-50/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Header / Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-200/40 flex items-center justify-center bg-white border border-slate-100">
            <Image
              src="/logoMain.png"
              alt="Samhitha"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Samhitha</h1>
            <p className="text-[11px] text-emerald-600 font-semibold tracking-[0.2em] uppercase mt-0.5">Admissions Tracker</p>
          </div>
          <p className="text-sm text-slate-500">Sign in to manage your admissions pipeline</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-emerald-100/50 bg-white/80 backdrop-blur-sm rounded-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Email or Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={emailOrUsername}
                    onChange={e => setEmailOrUsername(e.target.value)}
                    placeholder="you@email.com or username"
                    className="pl-9 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl bg-slate-50/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-9 border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20 rounded-xl bg-slate-50/50"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-lg shadow-emerald-200/50 transition-all duration-200 rounded-xl h-10"
                disabled={loading || !emailOrUsername || !password}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                Sign In
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-xs text-emerald-600 hover:text-emerald-700"
                onClick={() => setShowReset(true)}
              >
                Forgot password?
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400">
            Powered by Samhitha Admissions Platform
          </p>
        </div>
      </div>
    </div>
  );
}
