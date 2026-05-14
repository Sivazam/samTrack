'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { manageReminderViaCloudFunction } from '@/lib/cloud-functions';

interface SetReminderDialogProps {
  leadId: string;
  leadDisplayName: string;
  onClose: () => void;
}

export function SetReminderDialog({ leadId, leadDisplayName, onClose }: SetReminderDialogProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [dateOnly, setDateOnly] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!date) return;
    setSubmitting(true);
    try {
      const dueAt = dateOnly
        ? new Date(`${date}T09:00:00`)
        : new Date(`${date}T${time || '09:00'}:00`);
      
      await manageReminderViaCloudFunction({
        subAction: 'create',
        leadId,
        dueAt: dueAt.toISOString(),
        dueDateOnly: dateOnly,
        note: note || undefined,
      });
      onClose();
    } catch (e: any) { alert(e.message || 'Failed'); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-base">Set Reminder</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{leadDisplayName}</p>
        <div className="space-y-3">
          <div><Label className="text-xs">Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          {!dateOnly && <div><Label className="text-xs">Time</Label><Input type="time" value={time} onChange={e => setTime(e.target.value)} /></div>}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dateOnly} onChange={e => setDateOnly(e.target.checked)} />
            Date only (notify at 9 AM)
          </label>
          <div><Label className="text-xs">Note</Label><Input value={note} onChange={e => setNote(e.target.value)} placeholder="Follow-up note..." /></div>
          {/* Snooze presets for existing reminders */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              const d = new Date(Date.now() + 60 * 60 * 1000);
              setDate(d.toISOString().split('T')[0]);
              setTime(d.toTimeString().slice(0, 5));
              setDateOnly(false);
            }}>+1 Hour</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
              d.setHours(9, 0, 0, 0);
              setDate(d.toISOString().split('T')[0]);
              setTime('09:00');
              setDateOnly(true);
            }}>Tomorrow 9 AM</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !date}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
            Set Reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
