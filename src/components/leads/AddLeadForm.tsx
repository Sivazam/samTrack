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
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Division, IntermediateGroup } from '@/types';
import { createLeadViaCloudFunction } from '@/lib/cloud-functions';
import { TenantConfig } from '@/types';

interface AddLeadFormProps {
  onClose: () => void;
}

export function AddLeadForm({ onClose }: AddLeadFormProps) {
  const { user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Load divisions
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(collection(db, 'divisions'), where('tenantId', '==', user.tenantId), where('active', '==', true));
    const unsub: Unsubscribe = onSnapshot(q, snap => setDivisions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Division))),
    (error) => {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
        console.warn('Permission denied for divisions — claims may not be synced yet');
        setDivisions([]);
        return;
      }
      console.warn('Snapshot listener error:', error.code || error.message);
    });
    return () => unsub();
  }, [user?.tenantId]);

  // Load tenant config
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub: Unsubscribe = onSnapshot(
      doc(db, 'tenantConfig', user.tenantId),
      (snap) => {
        if (snap.exists()) setTenantConfig(snap.data() as TenantConfig);
      },
      (error) => {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
          console.warn('Permission denied for tenantConfig — claims may not be synced yet');
          return;
        }
        console.warn('Snapshot listener error:', error.code || error.message);
      }
    );
    return () => unsub();
  }, [user?.tenantId]);

  const handleSubmit = async () => {
    if (!form.uniqueLeadId || !form.parentName || !form.studentName || !form.divisionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const leadId = parseInt(form.uniqueLeadId, 10);
      await createLeadViaCloudFunction({ ...form, uniqueLeadId: leadId });
      toast.success('Lead added successfully!', { description: `Lead #${form.uniqueLeadId} has been created.` });
      onClose();
    } catch (e: any) {
      console.error('Add lead failed:', e);
      const msg: string = e?.message || 'Failed to add lead';
      // Firebase Functions wraps the message — extract the readable part
      const isDuplicate = msg.includes('already-exists') || msg.includes('already exists');
      setError(isDuplicate ? `Lead ID "${form.uniqueLeadId}" already exists. Use a different ID.` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Add New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <Label className="text-xs">Lead ID * <span className="text-slate-400 font-normal">(numbers only)</span></Label>
            <Input
              value={form.uniqueLeadId}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setForm(f => ({ ...f, uniqueLeadId: val }));
                setError(null);
              }}
              placeholder="e.g., 12345"
              inputMode="numeric"
              className={error && error.includes('already exists') ? 'border-red-400 focus:border-red-500' : ''}
            />
          </div>
          <div><Label className="text-xs">Parent Name *</Label><Input value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} /></div>
          <div><Label className="text-xs">Student Name *</Label><Input value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Parent Phone</Label><Input value={form.parentPhone} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} /></div>
            <div><Label className="text-xs">Student Phone</Label><Input value={form.studentPhone} onChange={e => setForm(f => ({ ...f, studentPhone: e.target.value }))} /></div>
          </div>
          <div>
            <Label className="text-xs">Intermediate Group</Label>
            <Select value={form.intermediateGroup} onValueChange={v => setForm(f => ({ ...f, intermediateGroup: v }))}>
              <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
              <SelectContent>
                {(tenantConfig?.intermediateGroups || []).filter(g => g.active).map(g => (
                  <SelectItem key={g.code} value={g.code}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
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
          <Button onClick={handleSubmit} disabled={submitting || !form.uniqueLeadId || !form.parentName || !form.studentName || !form.divisionId} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Add Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
