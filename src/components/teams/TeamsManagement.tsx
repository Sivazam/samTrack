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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Plus, Loader2, User, MapPin } from 'lucide-react';
import { Team, User as TUser, Division } from '@/types';
import { manageTeamViaCloudFunction } from '@/lib/cloud-functions';

export function TeamsManagement() {
  const { user: authUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<TUser[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.tenantId) return;
    const tid = authUser.tenantId;
    const u1 = onSnapshot(query(collection(db, 'teams'), where('tenantId', '==', tid)), s => { setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team))); setLoading(false); });
    const u2 = onSnapshot(query(collection(db, 'users'), where('tenantId', '==', tid), where('active', '==', true)), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as TUser))));
    const u3 = onSnapshot(query(collection(db, 'divisions'), where('tenantId', '==', tid), where('active', '==', true)), s => setDivisions(s.docs.map(d => ({ id: d.id, ...d.data() } as Division))));
    return () => { u1(); u2(); u3(); };
  }, [authUser?.tenantId]);

  const proUsers = users.filter(u => u.role === 'PRO');

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Teams ({teams.filter(t => t.active).length})</h2>
        <Button size="sm" onClick={() => setShowCreateForm(true)}><Plus className="h-4 w-4 mr-1" /> Create Team</Button>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <ScrollArea className="h-[60vh]">
          <div className="space-y-2">
            {teams.filter(t => t.active).map(team => {
              const members = team.memberUids.map(uid => users.find(u => u.id === uid)).filter(Boolean);
              const teamDivs = team.divisionIds.map(did => divisions.find(d => d.id === did)).filter(Boolean);
              return (
                <Card key={team.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">{team.name}</p>
                      <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={async () => {
                        if (confirm('Dissolve this team? Leads will need reassignment.')) {
                          await manageTeamViaCloudFunction({ subAction: 'dissolve', teamId: team.id });
                        }
                      }}>Dissolve</Button>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> Members: {members.map(m => m?.displayName).join(', ') || 'None'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> Divisions: {teamDivs.map(d => d?.name).join(', ') || 'None'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
      {showCreateForm && <CreateTeamForm proUsers={proUsers} divisions={divisions} onClose={() => setShowCreateForm(false)} />}
    </div>
  );
}

function CreateTeamForm({ proUsers, divisions, onClose }: { proUsers: TUser[]; divisions: Division[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [memberUids, setMemberUids] = useState<string[]>([]);
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || memberUids.length === 0) return;
    setSubmitting(true);
    try {
      await manageTeamViaCloudFunction({ subAction: 'create', name, memberUids, divisionIds });
      onClose();
    } catch (e: any) { alert(e.message || 'Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-base">Create Team</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Team Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Team RJY-1" /></div>
          <div>
            <Label className="text-xs">Members (1-2 PROs) *</Label>
            <div className="space-y-1">
              {proUsers.map(u => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={memberUids.includes(u.id)} onChange={e => {
                    if (e.target.checked && memberUids.length < 2) setMemberUids([...memberUids, u.id]);
                    else setMemberUids(memberUids.filter(id => id !== u.id));
                  }} />
                  {u.displayName} (@{u.username})
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Assigned Divisions</Label>
            <div className="space-y-1">
              {divisions.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={divisionIds.includes(d.id)} onChange={e => {
                    if (e.target.checked) setDivisionIds([...divisionIds, d.id]);
                    else setDivisionIds(divisionIds.filter(id => id !== d.id));
                  }} />
                  {d.name} ({d.code})
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name || memberUids.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
