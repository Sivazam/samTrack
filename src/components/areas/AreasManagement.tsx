'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, Loader2, Trash2, Users, Circle } from 'lucide-react';
import { Area } from '@/types';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const itemV = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function AreasManagement() {
  const { user: authUser } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [leadsCounts, setLeadsCounts] = useState<Record<string, number>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser?.tenantId) return;
    const tid = authUser.tenantId;

    const u1: Unsubscribe = onSnapshot(
      query(collection(db, 'divisions'), where('tenantId', '==', tid)),
      snap => {
        setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Area)));
        setLoading(false);
      },
      (error) => {
        console.warn('Snapshot listener error:', error.code || error.message);
        setAreas([]);
        setLoading(false);
      }
    );

    // Listen to leads to compute per-area lead counts
    const u2: Unsubscribe = onSnapshot(
      query(collection(db, 'leads'), where('tenantId', '==', tid), where('active', '==', true)),
      snap => {
        const counts: Record<string, number> = {};
        snap.docs.forEach(d => {
          const divId = d.data().divisionId as string;
          if (divId) counts[divId] = (counts[divId] || 0) + 1;
        });
        setLeadsCounts(counts);
      },
      (error) => {
        console.warn('Snapshot listener error:', error.code || error.message);
        setLeadsCounts({});
      }
    );

    return () => { u1(); u2(); };
  }, [authUser?.tenantId]);

  const activeAreas = useMemo(() => areas.filter(a => a.active), [areas]);
  const inactiveAreas = useMemo(() => areas.filter(a => !a.active), [areas]);

  return (
    <div className="space-y-4 px-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <MapPin className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              Areas
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-[10px] font-semibold px-2">
                {activeAreas.length}
              </Badge>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeAreas.length} active area{activeAreas.length !== 1 ? 's' : ''}
              {inactiveAreas.length > 0 && <span className="text-slate-300"> · {inactiveAreas.length} inactive</span>}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(true)} className="bg-emerald-600 hover:bg-emerald-700 rounded-lg h-8">
          <Plus className="h-4 w-4 mr-1" /> Add Area
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-3">
        <p className="text-xs text-emerald-700">
          <span className="font-semibold">How it works:</span> Create areas first, then assign them to teams. Leads linked to an area are automatically visible to the PROs in that team.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-slate-400">Loading areas...</p>
        </div>
      ) : activeAreas.length === 0 ? (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-4"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-sky-50 flex items-center justify-center"
          >
            <MapPin className="h-10 w-10 text-emerald-300" />
          </motion.div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-600">No areas yet</p>
            <p className="text-xs text-slate-400 max-w-[220px]">
              Create your first area to organize leads by geography and assign teams
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-9 mt-2"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create Your First Area
          </Button>
        </motion.div>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100dvh-320px)] pr-0.5">
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          {activeAreas.map(area => {
            const leadCount = leadsCounts[area.id] || 0;
            return (
              <motion.div key={area.id} variants={itemV} whileHover={{ y: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Gradient left accent border */}
                      <div className="w-1 shrink-0 bg-gradient-to-b from-emerald-500 via-emerald-400 to-teal-500" />

                      <div className="flex-1 p-4">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center shrink-0">
                            <MapPin className="h-5 w-5 text-emerald-600" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-slate-800">{area.name}</p>
                              {/* Active indicator */}
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-medium text-emerald-600">Active</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Code badge */}
                              <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0 font-mono font-semibold px-2 py-0.5 rounded-md">
                                {area.code}
                              </Badge>

                              {/* Lead count */}
                              {leadCount > 0 && (
                                <div className="flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full text-[10px] font-medium">
                                  <Users className="h-2.5 w-2.5" />
                                  {leadCount} {leadCount === 1 ? 'lead' : 'leads'}
                                </div>
                              )}

                              {area.description && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-[11px] text-slate-400 truncate max-w-[160px]">{area.description}</span>
                                </>
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

          {/* Inactive Areas Section */}
          {inactiveAreas.length > 0 && (
            <>
              <Separator className="bg-slate-100 my-2" />
              <div className="flex items-center gap-2 px-1">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Inactive ({inactiveAreas.length})
                </p>
              </div>
              {inactiveAreas.map(area => (
                <motion.div key={area.id} variants={itemV}>
                  <Card className="overflow-hidden border-0 shadow-sm opacity-60">
                    <CardContent className="p-0">
                      <div className="flex">
                        <div className="w-1 shrink-0 bg-slate-300" />
                        <div className="flex-1 p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                              <MapPin className="h-5 w-5 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-semibold text-slate-500">{area.name}</p>
                                <div className="flex items-center gap-1">
                                  <Circle className="h-2 w-2 text-slate-400" />
                                  <span className="text-[10px] font-medium text-slate-400">Inactive</span>
                                </div>
                              </div>
                              <Badge className="text-[10px] bg-slate-50 text-slate-400 border-0 font-mono px-2 py-0.5 rounded-md">
                                {area.code}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </>
          )}
        </motion.div>
        </div>
      )}

      <AnimatePresence>
        {showCreateForm && <CreateAreaForm onClose={() => setShowCreateForm(false)} />}
      </AnimatePresence>
    </div>
  );
}

function CreateAreaForm({ onClose }: { onClose: () => void }) {
  const { user: authUser } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name || !code) return;
    setSubmitting(true);
    try {
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
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-emerald-600" />
            </div>
            Add New Area
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-slate-600">Area Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Rajamahendravaram" className="mt-1 focus:border-emerald-300 focus:ring-emerald-200" autoFocus />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-600">Area Code *</Label>
            <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g., RJY" maxLength={10} className="mt-1 focus:border-emerald-300 focus:ring-emerald-200" />
            <p className="text-[10px] text-slate-400 mt-1">Short unique identifier (uppercase)</p>
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-600">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." rows={2} className="mt-1 resize-none focus:border-emerald-300 focus:ring-emerald-200" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting} className="rounded-lg">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name || !code} className="bg-emerald-600 hover:bg-emerald-700 rounded-lg">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create Area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
