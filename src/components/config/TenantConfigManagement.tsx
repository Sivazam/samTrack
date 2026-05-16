'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, Plus, Loader2, Trash2, Save } from 'lucide-react';
import { TenantConfig, StatusOption, IntermediateGroup, JoinedCollegeOption } from '@/types';
import { updateTenantConfigViaCloudFunction } from '@/lib/cloud-functions';

export function TenantConfigManagement() {
  const { user } = useAuth();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub: Unsubscribe = onSnapshot(doc(db, 'tenantConfig', user.tenantId), snap => {
      if (snap.exists()) setConfig(snap.data() as TenantConfig);
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
    });
    return () => unsub();
  }, [user?.tenantId]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateTenantConfigViaCloudFunction({
        statusOptions: config.statusOptions,
        intermediateGroups: config.intermediateGroups,
        joinedCollegeOptions: config.joinedCollegeOptions,
      });
    } catch (e: any) { alert(e.message || 'Save failed'); } finally { setSaving(false); }
  };

  if (!config) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2"><Settings className="h-4 w-4" /> Configuration</h2>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
        </Button>
      </div>

      <ScrollArea className="h-[70vh]">
        <div className="space-y-6">
          {/* Status Options */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Status Options ({config.statusOptions.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => {
                  setConfig({ ...config, statusOptions: [...config.statusOptions, { code: '', label: '', color: '#6b7280', isTerminal: false, order: config.statusOptions.length + 1, active: true }] });
                }}><Plus className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {config.statusOptions.map((opt, i) => (
                  <div key={i} className="space-y-1 border border-slate-100 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <Input className="w-20 h-8 text-xs" value={opt.code} onChange={e => {
                        const updated = [...config.statusOptions]; updated[i] = { ...updated[i], code: e.target.value.toUpperCase() };
                        setConfig({ ...config, statusOptions: updated });
                      }} placeholder="CODE" />
                      <Input className="flex-1 h-8 text-xs" value={opt.label} onChange={e => {
                        const updated = [...config.statusOptions]; updated[i] = { ...updated[i], label: e.target.value };
                        setConfig({ ...config, statusOptions: updated });
                      }} placeholder="Label" />
                      <input type="color" value={opt.color} onChange={e => {
                        const updated = [...config.statusOptions]; updated[i] = { ...updated[i], color: e.target.value };
                        setConfig({ ...config, statusOptions: updated });
                      }} className="w-8 h-8 rounded cursor-pointer" />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={opt.active} onChange={e => {
                        const updated = [...config.statusOptions]; updated[i] = { ...updated[i], active: e.target.checked };
                        setConfig({ ...config, statusOptions: updated });
                      }} /> Active</label>
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={opt.isTerminal} onChange={e => {
                        const updated = [...config.statusOptions]; updated[i] = { ...updated[i], isTerminal: e.target.checked };
                        setConfig({ ...config, statusOptions: updated });
                      }} /> Terminal</label>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setConfig({ ...config, statusOptions: config.statusOptions.filter((_, j) => j !== i) });
                      }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                    {/* Auto-reminder config row */}
                    <div className="flex items-center gap-2 pl-1">
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">Auto-reminder:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">Result date</span>
                        <input
                          type="date"
                          value={opt.autoReminderDate || ''}
                          onChange={e => {
                            const updated = [...config.statusOptions];
                            updated[i] = { ...updated[i], autoReminderDate: e.target.value || undefined };
                            setConfig({ ...config, statusOptions: updated });
                          }}
                          className="h-6 text-[10px] border border-slate-200 rounded px-1 bg-slate-50"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">+days</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={opt.autoReminderOffset ?? ''}
                          onChange={e => {
                            const updated = [...config.statusOptions];
                            const val = e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0);
                            updated[i] = { ...updated[i], autoReminderOffset: val };
                            setConfig({ ...config, statusOptions: updated });
                          }}
                          className="h-6 w-14 text-[10px] border border-slate-200 rounded px-1 bg-slate-50"
                          placeholder="0"
                        />
                      </div>
                      {opt.autoReminderDate && (
                        <span className="text-[10px] text-emerald-600 font-medium">
                          → {new Date(new Date(opt.autoReminderDate).getTime() + (opt.autoReminderOffset || 0) * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Intermediate Groups */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Intermediate Groups ({config.intermediateGroups.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => {
                  setConfig({ ...config, intermediateGroups: [...config.intermediateGroups, { code: '', label: '', order: config.intermediateGroups.length + 1, active: true }] });
                }}><Plus className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {config.intermediateGroups.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="w-20 h-8 text-xs" value={g.code} onChange={e => {
                      const updated = [...config.intermediateGroups]; updated[i] = { ...updated[i], code: e.target.value.toUpperCase() };
                      setConfig({ ...config, intermediateGroups: updated });
                    }} placeholder="CODE" />
                    <Input className="flex-1 h-8 text-xs" value={g.label} onChange={e => {
                      const updated = [...config.intermediateGroups]; updated[i] = { ...updated[i], label: e.target.value };
                      setConfig({ ...config, intermediateGroups: updated });
                    }} placeholder="Label" />
                    <Button variant="ghost" size="sm" onClick={() => {
                      setConfig({ ...config, intermediateGroups: config.intermediateGroups.filter((_, j) => j !== i) });
                    }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Joined College Options */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Joined College Options ({config.joinedCollegeOptions.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => {
                  setConfig({ ...config, joinedCollegeOptions: [...config.joinedCollegeOptions, { code: '', label: '', order: config.joinedCollegeOptions.length + 1, active: true }] });
                }}><Plus className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {config.joinedCollegeOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="w-20 h-8 text-xs" value={opt.code} onChange={e => {
                      const updated = [...config.joinedCollegeOptions]; updated[i] = { ...updated[i], code: e.target.value.toUpperCase() };
                      setConfig({ ...config, joinedCollegeOptions: updated });
                    }} placeholder="CODE" />
                    <Input className="flex-1 h-8 text-xs" value={opt.label} onChange={e => {
                      const updated = [...config.joinedCollegeOptions]; updated[i] = { ...updated[i], label: e.target.value };
                      setConfig({ ...config, joinedCollegeOptions: updated });
                    }} placeholder="Label" />
                    <Button variant="ghost" size="sm" onClick={() => {
                      setConfig({ ...config, joinedCollegeOptions: config.joinedCollegeOptions.filter((_, j) => j !== i) });
                    }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
