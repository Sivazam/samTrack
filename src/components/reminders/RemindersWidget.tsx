'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Bell, Clock, Calendar, RefreshCw, Check, MapPin, Users, User as UserIcon, Phone } from 'lucide-react';
import { Reminder } from '@/types';
import { manageReminderViaCloudFunction } from '@/lib/cloud-functions';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import { format } from 'date-fns';

interface RemindersWidgetProps {
  fullPage?: boolean;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } };

export function RemindersWidget({ fullPage = false }: RemindersWidgetProps) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING,SENT');

  useEffect(() => {
    if (!user?.tenantId) return;
    const statuses = statusFilter.split(',');
    const q = query(
      collection(db, 'reminders'),
      where('tenantId', '==', user.tenantId),
      where('status', 'in', statuses),
      orderBy('dueAt', 'asc')
    );
    const unsub: Unsubscribe = onSnapshot(q, snap => {
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
      setLoading(false);
    }, (error) => {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
        console.warn('Permission denied for reminders — claims may not be synced yet');
        setReminders([]);
        setLoading(false);
        return;
      }
      console.warn('Reminders snapshot error:', error.code || error.message);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.tenantId, statusFilter]);

  const handleComplete = async (reminderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await manageReminderViaCloudFunction({ subAction: 'complete', reminderId });
    } catch (err) { console.error('Complete reminder failed:', err); }
  };

  const formatDate = (ts?: Timestamp | any) => {
    if (!ts) return '';
    return format(ts?.toDate?.() || ts, 'dd MMM, hh:mm a');
  };

  const content = (
    <div className="space-y-2">
      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-emerald-500" /></div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No reminders</p>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show">
          {reminders.map(reminder => {
            const r = reminder as any;
            const teamLabel = r.teamName || r.teamId;
            const divisionLabel = r.divisionName;
            const assignedPROs: string[] = Array.isArray(r.assignedPRONames) ? r.assignedPRONames : [];
            const createdBy = r.createdByName;
            const createdByRole = r.createdByRole;
            const phone = r.parentPhone || r.studentPhone;
            return (
            <motion.div
              key={reminder.id}
              variants={item}
              whileHover={{ x: 2, backgroundColor: 'rgba(5, 150, 105, 0.03)' }}
              className="flex items-start justify-between border border-slate-100 rounded-lg p-3 cursor-pointer hover:shadow-sm transition-all"
              onClick={() => setSelectedLeadId(reminder.leadId)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <Bell className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-900 truncate">{reminder.leadDisplayName}</p>
                  <span className="text-[10px] text-slate-400">#{reminder.uniqueLeadId}</span>
                </div>

                {reminder.note && <p className="text-xs text-slate-600 mt-1 ml-9 italic">"{reminder.note}"</p>}

                {/* Rich metadata */}
                <div className="ml-9 mt-1.5 space-y-0.5">
                  {(teamLabel || divisionLabel) && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Users className="h-3 w-3" />
                      <span>{teamLabel || '—'}{divisionLabel ? ` · ${divisionLabel}` : ''}</span>
                    </div>
                  )}
                  {assignedPROs.length > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <UserIcon className="h-3 w-3" />
                      <span className="truncate">Assigned: {assignedPROs.join(', ')}</span>
                    </div>
                  )}
                  {createdBy && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span className="text-slate-400">Set by:</span>
                      <span className="font-medium">{createdBy}</span>
                      {createdByRole && <span className="text-slate-400">({createdByRole})</span>}
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Phone className="h-3 w-3" />
                      <span>{phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 ml-9 flex-wrap">
                  <Badge variant={(reminder.status as string) === 'OVERDUE' ? 'destructive' : 'outline'} className="text-[10px] border-emerald-200 text-emerald-700">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />{formatDate(reminder.dueAt)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">{reminder.status}</Badge>
                  {r.source === 'LOG_UPDATE_FORM' && (
                    <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">From Update</Badge>
                  )}
                  {r.autoCreated && (
                    <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700">Auto</Badge>
                  )}
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1 }} 
                whileTap={{ scale: 0.9 }}
                onClick={(e) => handleComplete(reminder.id, e)} 
                title="Mark Done"
                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full shrink-0 ml-2 inline-flex items-center justify-center"
              >
                <Check className="h-4 w-4" />
              </motion.button>
            </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-emerald-600" /> Reminders ({reminders.length})</h2>
          <div className="flex gap-1.5 flex-wrap">
            {['PENDING,SENT', 'PENDING', 'SENT', 'COMPLETED', 'SNOOZED'].map(f => (
              <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} className={`text-xs ${statusFilter === f ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={() => setStatusFilter(f)}>
                {f.replace(',', '+')}
              </Button>
            ))}
          </div>
        </div>
        {content}
        {selectedLeadId && <LeadDetailView leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
      </div>
    );
  }

  return content;
}
