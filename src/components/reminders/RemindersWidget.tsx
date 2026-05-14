'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Clock, Calendar, RefreshCw, Check } from 'lucide-react';
import { Reminder } from '@/types';
import { manageReminderViaCloudFunction } from '@/lib/cloud-functions';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import { format } from 'date-fns';

interface RemindersWidgetProps {
  fullPage?: boolean;
}

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
    }, err => { console.error('Reminders error:', err); setLoading(false); });
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
        <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No reminders</p>
        </div>
      ) : (
        reminders.map(reminder => (
          <div
            key={reminder.id}
            className="flex items-center justify-between border rounded-lg p-3 hover:bg-muted/50 cursor-pointer"
            onClick={() => setSelectedLeadId(reminder.leadId)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{reminder.leadDisplayName}</p>
              <p className="text-xs text-muted-foreground">ID: {reminder.uniqueLeadId}</p>
              {reminder.note && <p className="text-xs text-muted-foreground truncate">{reminder.note}</p>}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={(reminder.status as string) === 'OVERDUE' ? 'destructive' : 'outline'} className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />{formatDate(reminder.dueAt)}
                </Badge>
                <Badge variant="secondary" className="text-xs">{reminder.status}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={(e) => handleComplete(reminder.id, e)} title="Mark Done">
              <Check className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> Reminders ({reminders.length})</h2>
          <div className="flex gap-2">
            {['PENDING,SENT', 'PENDING', 'SENT', 'COMPLETED', 'SNOOZED'].map(f => (
              <Button key={f} size="sm" variant={statusFilter === f ? 'default' : 'outline'} className="text-xs" onClick={() => setStatusFilter(f)}>
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
