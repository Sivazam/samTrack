'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Loader2, Bell } from 'lucide-react';
import { manageReminderViaCloudFunction } from '@/lib/cloud-functions';

interface SetReminderDialogProps {
  leadId: string;
  leadDisplayName: string;
  onClose: () => void;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

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
        ? new Date(`${date}T10:00:00`)
        : new Date(`${date}T${time || '10:00'}:00`);
      
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
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Bell className="h-4 w-4 text-emerald-600" />
            </div>
            Set Reminder
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">{leadDisplayName}</p>
        </DialogHeader>
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
          <motion.div variants={item}>
            <Label className="text-xs">Date *</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="border-emerald-100 focus:border-emerald-400" />
          </motion.div>
          {!dateOnly && (
            <motion.div variants={item}>
              <Label className="text-xs">Time</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="border-emerald-100 focus:border-emerald-400" />
            </motion.div>
          )}
          <motion.div variants={item}>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={dateOnly} onChange={e => setDateOnly(e.target.checked)} className="accent-emerald-600" />
              Date only (notify at 10 AM)
            </label>
          </motion.div>
          <motion.div variants={item}>
            <Label className="text-xs">Note</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Follow-up note..." className="border-emerald-100 focus:border-emerald-400" />
          </motion.div>
          <motion.div variants={item} className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => {
              const d = new Date(Date.now() + 60 * 60 * 1000);
              setDate(d.toISOString().split('T')[0]);
              setTime(d.toTimeString().slice(0, 5));
              setDateOnly(false);
            }}>+1 Hour</Button>
            <Button variant="outline" size="sm" className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => {
              const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
              d.setHours(10, 0, 0, 0);
              setDate(d.toISOString().split('T')[0]);
              setTime('10:00');
              setDateOnly(true);
            }}>Tomorrow 10 AM</Button>
          </motion.div>
        </motion.div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !date} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
            Set Reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
