'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Users, Plus, Loader2, UserCheck, UserX, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
import { User, Role } from '@/types';
import { createUserViaCloudFunction, updateUserViaCloudFunction } from '@/lib/cloud-functions';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const ROLE_BADGES: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  COLLEGE_ADMIN: { color: 'bg-sky-100 text-sky-700 border-sky-200', icon: ShieldCheck, label: 'Admin' },
  MANAGER: { color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: UserCog, label: 'Manager' },
  PRO: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck, label: 'PRO' },
};

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
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setUsers([]);
      setLoading(false);
    });
    return () => unsub();
  }, [authUser?.tenantId]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-emerald-600" /> Users ({users.length})</h2>
        <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" /> Add User</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
      ) : (
        <ScrollArea className="h-[60vh]">
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
            {users.map(u => {
              const roleBadge = ROLE_BADGES[u.role] || ROLE_BADGES.PRO;
              const RoleIcon = roleBadge.icon;
              return (
                <motion.div key={u.id} variants={item} whileHover={{ y: -1 }}>
                  <Card className="border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                          {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{u.displayName}</p>
                          <p className="text-xs text-slate-400">{u.email} · @{u.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${roleBadge.color} border text-[10px] flex items-center gap-1`}>
                          <RoleIcon className="h-3 w-3" />{roleBadge.label}
                        </Badge>
                        <Badge variant={u.active ? 'default' : 'secondary'} className={`text-xs ${u.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}`}>
                          {u.active ? <UserCheck className="h-3 w-3 mr-1" /> : <UserX className="h-3 w-3 mr-1" />}
                          {u.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
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
        <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-600" />Create User</DialogTitle></DialogHeader>
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
                <SelectItem value="PRO">PRO (Field Officer)</SelectItem>
                <SelectItem value="MANAGER">Manager (Team Lead)</SelectItem>
                <SelectItem value="COLLEGE_ADMIN">College Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
