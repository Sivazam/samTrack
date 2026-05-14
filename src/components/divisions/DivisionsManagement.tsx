'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { Division } from '@/types';

// Division CRUD goes through criticalApi manageDivision action
// For now, we'll use direct Firestore writes as admin (via CF)
// Since division creation is simpler, we'll add a CF action or use a direct approach

export function DivisionsManagement() {
  const { user: authUser } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.tenantId) return;
    const q = query(collection(db, 'divisions'), where('tenantId', '==', authUser.tenantId));
    const unsub: Unsubscribe = onSnapshot(q, snap => {
      setDivisions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Division)));
      setLoading(false);
    });
    return () => unsub();
  }, [authUser?.tenantId]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Divisions ({divisions.filter(d => d.active).length})</h2>
        <Button size="sm" onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4 mr-1" /> Add Division</Button>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <ScrollArea className="h-[60vh]">
          <div className="space-y-2">
            {divisions.map(div => (
              <Card key={div.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{div.name}</p>
                    <p className="text-xs text-muted-foreground">Code: {div.code}</p>
                    {div.description && <p className="text-xs text-muted-foreground">{div.description}</p>}
                  </div>
                  <Badge variant={div.active ? 'default' : 'secondary'} className="text-xs">{div.active ? 'Active' : 'Inactive'}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      {showCreateForm && <CreateDivisionForm onClose={() => setShowCreateForm(false)} />}
    </div>
  );
}

function CreateDivisionForm({ onClose }: { onClose: () => void }) {
  const { user: authUser } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !code) return;
    setSubmitting(true);
    try {
      // Use modular Firestore SDK
      const { collection, addDoc, Timestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'divisions'), {
        tenantId: authUser?.tenantId,
        name,
        code: code.toUpperCase(),
        description: description || null,
        active: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      onClose();
    } catch (e: any) { alert(e.message || 'Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-base">Add Division</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Rajamahendravaram" /></div>
          <div><Label className="text-xs">Code *</Label><Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g., RJY" maxLength={10} /></div>
          <div><Label className="text-xs">Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name || !code}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Add Division
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
