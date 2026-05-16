'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, Unsubscribe } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { Division, Lead, TenantConfig } from '@/types';
import { updateLeadViaCloudFunction } from '@/lib/cloud-functions';

interface EditLeadFormProps {
  lead: Lead;
  onClose: () => void;
}

export function EditLeadForm({ lead, onClose }: EditLeadFormProps) {
  const { user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    parentName: lead.parentName || '',
    studentName: lead.studentName || '',
    parentPhone: lead.parentPhone || '',
    studentPhone: lead.studentPhone || '',
    intermediateGroup: lead.intermediateGroup || '',
    address: lead.address || '',
    divisionId: lead.divisionId || '',
  });

  // Load divisions
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(collection(db, 'divisions'), where('tenantId', '==', user.tenantId), where('active', '==', true));
    const unsub: Unsubscribe = onSnapshot(q,
      snap => setDivisions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Division))),
      (err) => {
        if (err?.code === 'permission-denied') return;
        console.warn('Divisions snapshot error:', err.message);
      }
    );
    return () => unsub();
  }, [user?.tenantId]);

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

  const handleSubmit = async () => {
    if (!form.parentName || !form.studentName || !form.divisionId) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateLeadViaCloudFunction({
        leadId: lead.id,
        parentName: form.parentName,
        studentName: form.studentName,
        parentPhone: form.parentPhone || undefined,
        studentPhone: form.studentPhone || undefined,
        intermediateGroup: form.intermediateGroup || undefined,
        address: form.address || undefined,
        divisionId: form.divisionId !== lead.divisionId ? form.divisionId : undefined,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to update lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => { if (!submitting) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Lead — #{lead.uniqueLeadId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lead ID — read-only */}
          <div>
            <Label className="text-xs">Lead ID (cannot be changed)</Label>
            <Input value={lead.uniqueLeadId} disabled className="bg-slate-50 text-slate-400 font-mono" />
          </div>

          <div>
            <Label className="text-xs">Parent Name *</Label>
            <Input value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Student Name *</Label>
            <Input value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Parent Phone</Label>
              <Input value={form.parentPhone} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Student Phone</Label>
              <Input value={form.studentPhone} onChange={e => setForm(f => ({ ...f, studentPhone: e.target.value }))} />
            </div>
          </div>
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
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Area *</Label>
            <Select value={form.divisionId} onValueChange={v => setForm(f => ({ ...f, divisionId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select area..." /></SelectTrigger>
              <SelectContent>
                {divisions.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.parentName || !form.studentName || !form.divisionId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
