'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, orderBy, limit, doc, Unsubscribe } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Division, TenantConfig } from '@/types';
import { createReferralLeadViaCloudFunction } from '@/lib/cloud-functions';

interface ProAddLeadFormProps {
  onClose: () => void;
}

export function ProAddLeadForm({ onClose }: ProAddLeadFormProps) {
  const { user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastLeadId, setLastLeadId] = useState<number | null>(null);
  const [loadingLastId, setLoadingLastId] = useState(true);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  const [form, setForm] = useState({
    uniqueLeadId: '',
    parentName: '',
    studentName: '',
    parentPhone: '',
    studentPhone: '',
    intermediateGroup: '',
    address: '',
    divisionId: '',
  });

  // Load divisions (restricted to user's assigned divisions if any)
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(
      collection(db, 'divisions'),
      where('tenantId', '==', user.tenantId),
      where('active', '==', true)
    );
    const unsub: Unsubscribe = onSnapshot(q,
      snap => {
        let divs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Division));
        // Filter to assigned divisions if the PRO has them
        const assignedIds: string[] = (user as any).assignedDivisionIds || [];
        if (assignedIds.length > 0) {
          divs = divs.filter(d => assignedIds.includes(d.id));
        }
        setDivisions(divs.sort((a, b) => a.name.localeCompare(b.name)));
      },
      err => {
        if (err?.code === 'permission-denied') return;
        console.warn('Divisions error:', err.message);
      }
    );
    return () => unsub();
  }, [user?.tenantId, (user as any)?.assignedDivisionIds]);

  // Load tenant config (for intermediate groups)
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub: Unsubscribe = onSnapshot(
      doc(db, 'tenantConfig', user.tenantId),
      (snap) => { if (snap.exists()) setTenantConfig(snap.data() as TenantConfig); },
      (err) => { if (err?.code !== 'permission-denied') console.warn('TenantConfig error:', err.message); }
    );
    return () => unsub();
  }, [user?.tenantId]);

  // Fetch the highest existing lead ID for this tenant
  useEffect(() => {
    if (!user?.tenantId) return;
    const fetchLastId = async () => {
      setLoadingLastId(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, 'leads'),
            where('tenantId', '==', user.tenantId),
            orderBy('uniqueLeadId', 'desc'),
            limit(1)
          )
        );
        if (!snap.empty) {
          setLastLeadId(snap.docs[0].data().uniqueLeadId as number);
        } else {
          setLastLeadId(0);
        }
      } catch (e) {
        console.warn('Could not fetch last lead ID:', e);
        setLastLeadId(null);
      } finally {
        setLoadingLastId(false);
      }
    };
    fetchLastId();
  }, [user?.tenantId]);

  // Check phone duplicates on blur
  const checkPhoneDuplicate = useCallback(async (phone: string) => {
    if (!phone || phone.length < 10 || !user?.tenantId) return;
    setCheckingPhone(true);
    setPhoneWarning(null);
    setConfirmedDuplicate(false);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const [byParent, byStudent] = await Promise.all([
        getDocs(query(
          collection(db, 'leads'),
          where('tenantId', '==', user.tenantId),
          where('parentPhone', '==', cleanPhone),
          limit(1)
        )),
        getDocs(query(
          collection(db, 'leads'),
          where('tenantId', '==', user.tenantId),
          where('studentPhone', '==', cleanPhone),
          limit(1)
        )),
      ]);
      if (!byParent.empty || !byStudent.empty) {
        const match = byParent.empty ? byStudent.docs[0] : byParent.docs[0];
        const data = match.data();
        setPhoneWarning(
          `Phone already exists in Lead #${data.uniqueLeadId} — ${data.studentName || data.parentName}. You may still proceed if this is intentional.`
        );
      }
    } catch {
      // silently ignore phone check failures
    } finally {
      setCheckingPhone(false);
    }
  }, [user?.tenantId]);

  const handleSubmit = async () => {
    if (!form.uniqueLeadId || !form.parentName || !form.studentName || !form.divisionId) return;
    if (phoneWarning && !confirmedDuplicate) {
      setConfirmedDuplicate(true);
      return; // First click with warning = show confirmation; second click = proceed
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReferralLeadViaCloudFunction({
        uniqueLeadId: Number(form.uniqueLeadId),
        parentName: form.parentName,
        studentName: form.studentName,
        parentPhone: form.parentPhone || undefined,
        studentPhone: form.studentPhone || undefined,
        intermediateGroup: form.intermediateGroup || undefined,
        address: form.address || undefined,
        divisionId: form.divisionId,
      });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setError(e?.message || 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => { if (!submitting) onClose(); }}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">Add Referral Lead</DialogTitle>
            <Badge className="bg-purple-100 text-purple-700 border-0 text-[10px] font-bold">REFERRAL</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Leads you create are tagged as referral and visible to your manager.</p>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700">Lead created successfully!</p>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Lead ID with hint */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Lead ID *</Label>
                {loadingLastId ? (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading last ID...
                  </span>
                ) : lastLeadId !== null && (
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <Info className="h-3 w-3" /> Last used: #{lastLeadId} → suggest #{lastLeadId + 1}
                  </span>
                )}
              </div>
              <Input
                value={form.uniqueLeadId}
                onChange={e => setForm(f => ({ ...f, uniqueLeadId: e.target.value.replace(/\D/g, '') }))}
                placeholder={lastLeadId !== null ? `${lastLeadId + 1}` : 'Enter lead number'}
                inputMode="numeric"
                className="font-mono"
              />
            </div>

            <div>
              <Label className="text-xs">Parent Name *</Label>
              <Input
                value={form.parentName}
                onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))}
                placeholder="Parent's full name"
              />
            </div>

            <div>
              <Label className="text-xs">Student Name *</Label>
              <Input
                value={form.studentName}
                onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))}
                placeholder="Student's full name"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Parent Phone</Label>
                <Input
                  value={form.parentPhone}
                  onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value.replace(/\D/g, '') }))}
                  onBlur={e => checkPhoneDuplicate(e.target.value)}
                  placeholder="10-digit number"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div>
                <Label className="text-xs">Student Phone</Label>
                <Input
                  value={form.studentPhone}
                  onChange={e => setForm(f => ({ ...f, studentPhone: e.target.value.replace(/\D/g, '') }))}
                  onBlur={e => checkPhoneDuplicate(e.target.value)}
                  placeholder="10-digit number"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Phone duplicate warning */}
            {(checkingPhone || phoneWarning) && (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                confirmedDuplicate
                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                <span>
                  {checkingPhone ? 'Checking for duplicates...' : phoneWarning}
                  {confirmedDuplicate && !checkingPhone && (
                    <span className="font-semibold ml-1 text-emerald-700"> — Proceeding anyway.</span>
                  )}
                </span>
              </div>
            )}

            <div>
              <Label className="text-xs">Intermediate Group</Label>
              <Select
                value={form.intermediateGroup || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, intermediateGroup: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {(tenantConfig?.intermediateGroups || []).filter(g => g.active).map(g => (
                    <SelectItem key={g.code} value={g.code}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Optional address"
              />
            </div>

            <div>
              <Label className="text-xs">Area *</Label>
              <Select value={form.divisionId} onValueChange={v => setForm(f => ({ ...f, divisionId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select area..." /></SelectTrigger>
                <SelectContent>
                  {divisions.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!success && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.uniqueLeadId || !form.parentName || !form.studentName || !form.divisionId}
              className={phoneWarning && !confirmedDuplicate
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
              }
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {phoneWarning && !confirmedDuplicate ? 'Duplicate found — click to confirm' : 'Create Referral Lead'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
