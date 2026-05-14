'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
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
    const unsub: Unsubscribe = onSnapshot(q, snap => setDivisions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Division))));
    return () => unsub();
  }, [user?.tenantId]);

  // Load tenant config
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub: Unsubscribe = onSnapshot(
      { getSource: () => db } as any,
      (snap: any) => { /* placeholder */ }
    );
    // Proper listener
    import('firebase/firestore').then(({ doc: d, onSnapshot: os }) => {
      const unsub2 = os(d(db, 'tenantConfig', user.tenantId!), snap => {
        if (snap.exists()) setTenantConfig(snap.data() as TenantConfig);
      });
      return () => unsub2();
    });
  }, [user?.tenantId]);

  const handleSubmit = async () => {
    if (!form.uniqueLeadId || !form.parentName || !form.studentName || !form.divisionId) return;
    setSubmitting(true);
    try {
      await createLeadViaCloudFunction(form);
      onClose();
    } catch (e: any) {
      console.error('Add lead failed:', e);
      alert(e.message || 'Failed to add lead');
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
          <div><Label className="text-xs">Lead ID *</Label><Input value={form.uniqueLeadId} onChange={e => setForm(f => ({ ...f, uniqueLeadId: e.target.value }))} placeholder="e.g., RJY-001" /></div>
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
            <Label className="text-xs">Division *</Label>
            <Select value={form.divisionId} onValueChange={v => setForm(f => ({ ...f, divisionId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select division..." /></SelectTrigger>
              <SelectContent>
                {divisions.map(d => <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !form.uniqueLeadId || !form.parentName || !form.studentName || !form.divisionId}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Add Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
