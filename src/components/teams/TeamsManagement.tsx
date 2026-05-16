'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Loader2, UserCog, MapPin, Search, X, UserPlus, CheckCircle2 } from 'lucide-react';
import { Team, User as TUser, Division } from '@/types';
import { manageTeamViaCloudFunction } from '@/lib/cloud-functions';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function TeamsManagement() {
  const { user: authUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<TUser[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authUser?.tenantId) return;
    const tid = authUser.tenantId;
    const u1 = onSnapshot(query(collection(db, 'teams'), where('tenantId', '==', tid)), s => { setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team))); setLoading(false); }, (error) => { console.warn('Snapshot listener error:', error.code || error.message); setTeams([]); setLoading(false); });
    const u2 = onSnapshot(query(collection(db, 'users'), where('tenantId', '==', tid), where('active', '==', true)), s => setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as TUser))), (error) => { console.warn('Snapshot listener error:', error.code || error.message); setUsers([]); });
    const u3 = onSnapshot(query(collection(db, 'divisions'), where('tenantId', '==', tid), where('active', '==', true)), s => setDivisions(s.docs.map(d => ({ id: d.id, ...d.data() } as Division))), (error) => { console.warn('Snapshot listener error:', error.code || error.message); setDivisions([]); });
    return () => { u1(); u2(); u3(); };
  }, [authUser?.tenantId]);

  const proUsers = users.filter(u => u.role === 'PRO');

  // Compute which PROs and Areas are already in active teams
  const prosInTeams = new Set<string>();
  const proTeamMap = new Map<string, string>();
  const areaTeamMap = new Map<string, string>();
  teams.filter(t => t.active).forEach(team => {
    team.memberUids?.forEach(uid => {
      prosInTeams.add(uid);
      proTeamMap.set(uid, team.name);
    });
    team.divisionIds?.forEach(did => {
      areaTeamMap.set(did, team.name);
    });
  });

  const availablePros = proUsers.filter(u => !prosInTeams.has(u.id));
  const unavailablePros = proUsers.filter(u => prosInTeams.has(u.id));

  const activeTeams = useMemo(() => teams.filter(t => t.active), [teams]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return activeTeams;
    const q = searchQuery.toLowerCase().trim();
    return activeTeams.filter(team => {
      const members = team.memberUids.map(uid => users.find(u => u.id === uid)).filter(Boolean) as TUser[];
      const teamDivs = team.divisionIds.map(did => divisions.find(d => d.id === did)).filter(Boolean) as Division[];
      return (
        team.name.toLowerCase().includes(q) ||
        members.some(m => m.displayName.toLowerCase().includes(q)) ||
        teamDivs.some(d => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
      );
    });
  }, [activeTeams, searchQuery, users, divisions]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserCog className="h-4 w-4 text-emerald-600" />
            </div>
            Teams
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-[10px] font-semibold px-2 ml-1">
              {activeTeams.length}
            </Badge>
          </h2>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-emerald-600 hover:bg-emerald-700 h-8 rounded-lg">
          <Plus className="h-4 w-4 mr-1" /> Create Team
        </Button>
      </div>

      {/* Search Bar */}
      {activeTeams.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search teams by name, member, or area..."
            className="pl-9 pr-9 h-9 rounded-xl bg-slate-50/80 border-slate-100 text-sm placeholder:text-slate-400 focus:border-emerald-200 focus:ring-emerald-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-slate-400">Loading teams...</p>
        </div>
      ) : activeTeams.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-4"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center"
          >
            <UserCog className="h-10 w-10 text-emerald-300" />
          </motion.div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-600">No teams yet</p>
            <p className="text-xs text-slate-400 max-w-[220px]">
              Create your first team to assign PROs and areas for lead management
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-9 mt-2"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create Your First Team
          </Button>
        </motion.div>
      ) : (
        /* Teams List */
        <ScrollArea className="h-[60vh]">
          {/* Search results count */}
          {searchQuery && (
            <p className="text-xs text-slate-400 mb-2">
              {filteredTeams.length} of {activeTeams.length} team{activeTeams.length !== 1 ? 's' : ''}
              {filteredTeams.length === 0 && <span className="text-red-400 ml-1">— No matches</span>}
            </p>
          )}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
            {filteredTeams.map(team => {
              const members = team.memberUids.map(uid => users.find(u => u.id === uid)).filter(Boolean) as TUser[];
              const teamDivs = team.divisionIds.map(did => divisions.find(d => d.id === did)).filter(Boolean) as Division[];
              return (
                <motion.div key={team.id} variants={itemVariants} whileHover={{ y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      {/* Gradient left border + content */}
                      <div className="flex">
                        {/* Left accent border */}
                        <div className="w-1 shrink-0 bg-gradient-to-b from-emerald-500 via-emerald-400 to-teal-500" />

                        <div className="flex-1 p-4">
                          {/* Team header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center">
                                <UserCog className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{team.name}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 h-7" onClick={async () => {
                              if (confirm('Dissolve this team? Leads will need reassignment.')) {
                                await manageTeamViaCloudFunction({ subAction: 'dissolve', teamId: team.id });
                              }
                            }}>Dissolve</Button>
                          </div>

                          {/* Stat Pills */}
                          <div className="flex gap-2 mb-3">
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-medium">
                              <Users className="h-3 w-3" />
                              {members.length} {members.length === 1 ? 'Member' : 'Members'}
                            </div>
                            <div className="flex items-center gap-1.5 bg-sky-50 text-sky-700 px-2.5 py-1 rounded-full text-xs font-medium">
                              <MapPin className="h-3 w-3" />
                              {teamDivs.length} {teamDivs.length === 1 ? 'Area' : 'Areas'}
                            </div>
                          </div>

                          {/* Members as avatar circles */}
                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                <Users className="h-3 w-3" /> Members
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {members.length > 0 ? members.map(m => (
                                  <div key={m.id} className="flex items-center gap-2 bg-emerald-50/60 border border-emerald-100 rounded-full pl-1 pr-3 py-0.5">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center">
                                      <span className="text-[9px] font-bold text-white">{getInitials(m.displayName)}</span>
                                    </div>
                                    <span className="text-xs font-medium text-slate-700">{m.displayName}</span>
                                    <span className="text-[10px] text-emerald-500 font-medium">PRO</span>
                                  </div>
                                )) : (
                                  <span className="text-xs text-slate-400 italic">No members</span>
                                )}
                              </div>
                            </div>

                            <Separator className="bg-slate-100" />

                            {/* Areas with MapPin badges */}
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                <MapPin className="h-3 w-3" /> Areas
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {teamDivs.length > 0 ? teamDivs.map(d => (
                                  <Badge key={d.id} className="text-xs bg-sky-50 text-sky-700 border-sky-100 border hover:bg-sky-100 transition-colors">
                                    <MapPin className="h-2.5 w-2.5 mr-1" />
                                    {d.name}
                                    <span className="ml-1 text-sky-400 font-mono text-[10px]">{d.code}</span>
                                  </Badge>
                                )) : (
                                  <span className="text-xs text-slate-400 italic">No areas assigned</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </ScrollArea>
      )}

      {/* Create Team Dialog */}
      <AnimatePresence>
        {showCreateForm && (
          <CreateTeamForm
            availablePros={availablePros}
            unavailablePros={unavailablePros}
            proTeamMap={proTeamMap}
            areaTeamMap={areaTeamMap}
            divisions={divisions}
            onClose={() => setShowCreateForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateTeamForm({
  availablePros,
  unavailablePros,
  proTeamMap,
  areaTeamMap,
  divisions,
  onClose,
}: {
  availablePros: TUser[];
  unavailablePros: TUser[];
  proTeamMap: Map<string, string>;
  areaTeamMap: Map<string, string>;
  divisions: Division[];
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [memberUids, setMemberUids] = useState<string[]>([]);
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const MAX_MEMBERS = 5;

  const totalSteps = 3;
  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = memberUids.length > 0;
  const canSubmit = canProceedStep1 && canProceedStep2;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await manageTeamViaCloudFunction({ subAction: 'create', name, memberUids, divisionIds });
      onClose();
    } catch (e: any) { alert(e.message || 'Failed'); } finally { setSubmitting(false); }
  };

  const stepLabels = ['Name', 'Members', 'Areas'];

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserCog className="h-4 w-4 text-emerald-600" />
            </div>
            Create New Team
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 px-1">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isComplete ? 'bg-emerald-500 text-white' :
                  isActive ? 'bg-emerald-600 text-white' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {isComplete ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
                </div>
                <span className={`text-xs font-medium transition-colors ${
                  isActive ? 'text-emerald-700' : isComplete ? 'text-emerald-600' : 'text-slate-400'
                }`}>{label}</span>
                {idx < stepLabels.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-colors ${
                    isComplete ? 'bg-emerald-400' : 'bg-slate-100'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-3 min-h-[180px]">
          {/* Step 1: Team Name */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">Team Name *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Team RJY-1"
                  className="mt-1.5 focus:border-emerald-300 focus:ring-emerald-200"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Choose a descriptive name that identifies the team&apos;s primary area or function.
              </p>
            </motion.div>
          )}

          {/* Step 2: Members */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-600">
                  <UserPlus className="h-3 w-3 inline mr-1 text-emerald-500" />
                  Select Members (PROs) *
                </Label>
                <span className="text-[11px] text-slate-400">{memberUids.length}/{MAX_MEMBERS}</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-xl border border-slate-100 p-1">
                {availablePros.map(u => {
                  const isSelected = memberUids.includes(u.id);
                  return (
                    <label key={u.id} className={`flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked && memberUids.length < MAX_MEMBERS) setMemberUids([...memberUids, u.id]);
                          else setMemberUids(memberUids.filter(id => id !== u.id));
                        }}
                        className="accent-emerald-600"
                      />
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-bold text-white">{getInitials(u.displayName)}</span>
                      </div>
                      <span className="font-medium text-slate-700">{u.displayName}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">@{u.username}</span>
                    </label>
                  );
                })}
                {unavailablePros.map(u => (
                  <div key={u.id} className="flex items-center gap-2.5 text-sm p-2 rounded-lg bg-slate-50/60 opacity-50 cursor-not-allowed">
                    <input type="checkbox" disabled className="accent-emerald-600" />
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <span className="text-[8px] font-bold text-slate-500">{getInitials(u.displayName)}</span>
                    </div>
                    <span className="line-through text-slate-400">{u.displayName}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-400 ml-auto">
                      In {proTeamMap.get(u.id)}
                    </Badge>
                  </div>
                ))}
                {availablePros.length === 0 && unavailablePros.length > 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-3">All PROs are already assigned to teams.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Areas */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-slate-600">
                  <MapPin className="h-3 w-3 inline mr-1 text-sky-500" />
                  Assigned Areas
                </Label>
                <span className="text-[11px] text-slate-400">{divisionIds.length} selected</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-xl border border-slate-100 p-1">
                {divisions.map(d => {
                  const isSelected = divisionIds.includes(d.id);
                  const assignedTeam = areaTeamMap.get(d.id);
                  const isAlreadyAssigned = !!assignedTeam;
                  return (
                    <label key={d.id} className={`flex items-center gap-2.5 text-sm cursor-pointer p-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-sky-50 border border-sky-200' : 'hover:bg-slate-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => {
                          if (e.target.checked) {
                            if (isAlreadyAssigned && !confirm(`Warning: Area "${d.name}" is already assigned to "${assignedTeam}". Are you sure you want to assign it here too?`)) {
                              return;
                            }
                            setDivisionIds([...divisionIds, d.id]);
                          } else {
                            setDivisionIds(divisionIds.filter(id => id !== d.id));
                          }
                        }}
                        className="accent-emerald-600"
                      />
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center shrink-0">
                        <MapPin className="h-3 w-3 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700 leading-tight">{d.name}</span>
                        {isAlreadyAssigned && !isSelected && (
                          <div className="mt-1 inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-tight bg-rose-100 text-red-700 border border-rose-200">
                            Already assigned to: {assignedTeam}
                          </div>
                        )}
                        {isAlreadyAssigned && isSelected && (
                          <div className="mt-1 inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-tight bg-rose-500 text-white shadow-sm">
                            Warning: Overlapping with {assignedTeam}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono border-slate-200 text-slate-500 ml-auto">{d.code}</Badge>
                    </label>
                  );
                })}
                {divisions.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-3">No areas available. Create areas first.</p>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Areas determine which leads are visible to this team&apos;s members.
              </p>
            </motion.div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={submitting} className="rounded-lg">
              Back
            </Button>
          )}
          {step < totalSteps ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
              className="bg-emerald-600 hover:bg-emerald-700 rounded-lg"
            >
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting || !canSubmit} className="bg-emerald-600 hover:bg-emerald-700 rounded-lg">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create Team
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={submitting} className="rounded-lg text-slate-400 hover:text-slate-600">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
