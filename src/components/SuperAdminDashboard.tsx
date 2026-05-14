'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, Plus, LogOut, Eye, UserCheck, UserX, Loader2 } from 'lucide-react';
import { Tenant, User } from '@/types';
import { adminCreateTenantViaCloudFunction, adminUpdateTenantViaCloudFunction } from '@/lib/cloud-functions';

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  // Load tenants
  useEffect(() => {
    const unsub: Unsubscribe = onSnapshot(collection(db, 'tenants'), snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load all users
  useEffect(() => {
    const unsub: Unsubscribe = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
    return () => unsub();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'SUSPENDED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-800';
      case 'COLLEGE_ADMIN': return 'bg-blue-100 text-blue-800';
      case 'MANAGER': return 'bg-cyan-100 text-cyan-800';
      case 'PRO': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Samhitha Admissions</h1>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Colleges ({tenants.length})</h2>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create College</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>College</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>PROs</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map(tenant => {
                    const tenantUsers = users.filter(u => u.tenantId === tenant.id);
                    const proCount = tenantUsers.filter(u => u.role === 'PRO').length;
                    return (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{tenant.name}</p>
                              <p className="text-xs text-muted-foreground">{tenant.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge className={getStatusColor(tenant.status)}>{tenant.status}</Badge></TableCell>
                        <TableCell className="text-sm">{tenantUsers.length}</TableCell>
                        <TableCell className="text-sm">{proCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedTenant(tenant)}>
                              <Eye className="h-4 w-4 mr-1" /> View
                            </Button>
                            <Button variant="outline" size="sm" onClick={async () => {
                              const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                              await adminUpdateTenantViaCloudFunction({ tenantId: tenant.id, updateData: { status: newStatus } });
                            }}>
                              {tenant.status === 'ACTIVE' ? <><UserX className="h-4 w-4 mr-1" /> Suspend</> : <><UserCheck className="h-4 w-4 mr-1" /> Activate</>}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Tenant Dialog */}
      {showCreate && <CreateTenantDialog onClose={() => setShowCreate(false)} />}

      {/* Tenant Details Dialog */}
      {selectedTenant && (
        <Dialog open={true} onOpenChange={() => setSelectedTenant(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTenant.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Status</p><Badge className={getStatusColor(selectedTenant.status)}>{selectedTenant.status}</Badge></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Users</p><p className="text-lg font-bold">{users.filter(u => u.tenantId === selectedTenant.id).length}</p></CardContent></Card>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Users</h3>
                <div className="space-y-2">
                  {users.filter(u => u.tenantId === selectedTenant.id).map(u => (
                    <div key={u.id} className="flex items-center justify-between border rounded-lg p-2">
                      <div>
                        <p className="text-sm font-medium">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleColor(u.role)}>{u.role}</Badge>
                        <Badge variant={u.active ? 'default' : 'secondary'} className="text-xs">{u.active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateTenantDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !adminEmail || !adminPassword) return;
    setSubmitting(true);
    try {
      await adminCreateTenantViaCloudFunction({
        name,
        adminEmail,
        adminPassword,
        adminDisplayName: adminDisplayName || adminEmail,
        adminUsername: adminUsername || 'admin',
      });
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to create tenant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create College</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">College Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Samhitha College" /></div>
          <div><Label className="text-xs">Admin Email *</Label><Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@college.edu" /></div>
          <div><Label className="text-xs">Admin Password *</Label><Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} /></div>
          <div><Label className="text-xs">Admin Display Name</Label><Input value={adminDisplayName} onChange={e => setAdminDisplayName(e.target.value)} /></div>
          <div><Label className="text-xs">Admin Username</Label><Input value={adminUsername} onChange={e => setAdminUsername(e.target.value.toLowerCase())} placeholder="admin" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name || !adminEmail || !adminPassword}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create College
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
