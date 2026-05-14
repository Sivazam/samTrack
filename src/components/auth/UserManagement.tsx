'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Plus, Loader2, UserCheck, UserX } from 'lucide-react';
import { User, Role } from '@/types';
import { createUserViaCloudFunction, updateUserViaCloudFunction } from '@/lib/cloud-functions';

export function UserManagement() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.tenantId) return;
    const q = query(collection(db, 'users'), where('tenantId', '==', authUser.tenantId));
    const unsub: Unsubscribe = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    });
    return () => unsub();
  }, [authUser?.tenantId]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Users ({users.length})</h2>
        <Button size="sm" onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4 mr-1" /> Add User</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <ScrollArea className="h-[60vh]">
          <div className="space-y-2">
            {users.map(u => (
              <Card key={u.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground">{u.email} • @{u.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.role === 'PRO' ? 'outline' : 'default'} className="text-xs">{u.role}</Badge>
                    <Badge variant={u.active ? 'default' : 'secondary'} className="text-xs">
                      {u.active ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
                      {u.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {showCreateForm && <CreateUserForm onClose={() => setShowCreateForm(false)} />}
    </div>
  );
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const { user: authUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: '', username: '', password: '', displayName: '', role: 'PRO' as Role, phone: '' });

  const handleSubmit = async () => {
    if (!form.email || !form.username || !form.password || !form.displayName) return;
    setSubmitting(true);
    try {
      await createUserViaCloudFunction(form);
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">Create User</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><Label className="text-xs">Username *</Label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="lowercase, 3-30 chars" /></div>
          <div><Label className="text-xs">Password *</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
          <div><Label className="text-xs">Display Name *</Label><Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} /></div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRO">PRO</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="COLLEGE_ADMIN">College Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
