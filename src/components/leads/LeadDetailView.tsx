'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, Unsubscribe, Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, MapPin, Clock, Calendar, User, Activity, X, Navigation } from 'lucide-react';
import { Lead, StatusUpdate, ApproachType } from '@/types';
import { format } from 'date-fns';
import { LogStatusUpdateForm } from './LogStatusUpdateForm';
import { SetReminderDialog } from '@/components/reminders/SetReminderDialog';

interface LeadDetailViewProps {
  leadId: string;
  onClose: () => void;
}

export function LeadDetailView({ leadId, onClose }: LeadDetailViewProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);

  // Lead onSnapshot
  useEffect(() => {
    const unsubscribe: Unsubscribe = onSnapshot(doc(db, 'leads', leadId), (doc) => {
      if (doc.exists()) setLead({ id: doc.id, ...doc.data() } as Lead);
    });
    return () => unsubscribe();
  }, [leadId]);

  // Status updates onSnapshot
  useEffect(() => {
    const q = query(
      collection(db, 'leads', leadId, 'statusUpdates'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setStatusUpdates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StatusUpdate)));
    });
    return () => unsubscribe();
  }, [leadId]);

  const formatPhone = (phone?: string) => phone?.replace(/(\d{5})(\d{5})/, '$1 $2') || '';
  const formatDate = (ts?: Timestamp | any) => {
    if (!ts) return '';
    return format(ts?.toDate?.() || ts, 'dd MMM yyyy, hh:mm a');
  };

  const APPROACH_LABELS: Record<ApproachType, string> = {
    PHONE: '📞 Phone',
    DOORSTEP: '🏠 Doorstep',
    WALK_IN: '🚶 Walk-in',
    ONLINE: '💻 Online',
  };

  return (
    <Sheet open={true} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <SheetTitle className="text-base">
            {lead ? `${lead.parentName} / ${lead.studentName}` : 'Loading...'}
          </SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ID: {lead?.uniqueLeadId}</span>
            {lead?.lastStatusCode && <Badge variant="secondary">{lead.lastStatusLabel || lead.lastStatusCode}</Badge>}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {/* Lead Info */}
            {lead && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground text-xs">Parent</span><p>{lead.parentName}</p></div>
                    <div><span className="text-muted-foreground text-xs">Student</span><p>{lead.studentName}</p></div>
                    {lead.parentPhone && (
                      <div><span className="text-muted-foreground text-xs">Parent Phone</span><p>{formatPhone(lead.parentPhone)}</p></div>
                    )}
                    {lead.studentPhone && (
                      <div><span className="text-muted-foreground text-xs">Student Phone</span><p>{formatPhone(lead.studentPhone)}</p></div>
                    )}
                    {lead.intermediateGroup && (
                      <div><span className="text-muted-foreground text-xs">Group</span><p>{lead.intermediateGroup}</p></div>
                    )}
                    <div><span className="text-muted-foreground text-xs">Division</span><p>{lead.divisionName}</p></div>
                    {lead.address && (
                      <div className="col-span-2"><span className="text-muted-foreground text-xs">Address</span><p>{lead.address}</p></div>
                    )}
                    {lead.nextFollowupAt && (
                      <div className="col-span-2">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          Follow-up: {formatDate(lead.nextFollowupAt)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button className="flex-1" size="sm" onClick={() => setShowLogForm(true)}>
                <Activity className="h-4 w-4 mr-1" /> Log Update
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowReminderDialog(true)}>
                <Clock className="h-4 w-4 mr-1" /> Reminder
              </Button>
            </div>

            <Separator />

            {/* Status History */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Status History</h3>
              {statusUpdates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No updates yet</p>
              ) : (
                <div className="space-y-3">
                  {statusUpdates.map((update) => (
                    <div key={update.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{update.statusLabel || update.statusCode}</Badge>
                          <span className="text-xs text-muted-foreground">{APPROACH_LABELS[update.approachType]}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(update.createdAt)}</span>
                      </div>
                      {update.comments && <p className="text-sm mt-1">{update.comments}</p>}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> {update.loggedByName}
                        {update.accompanyingMemberName && ` + ${update.accompanyingMemberName}`}
                      </div>
                      {update.gpsCaptured && update.gpsLocation && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-blue-500">
                          <Navigation className="h-3 w-3" />
                          {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                          <span className="text-muted-foreground">(±{Math.round(update.gpsLocation.accuracyMeters)}m)</span>
                          <a
                            href={`https://www.google.com/maps?q=${update.gpsLocation.lat},${update.gpsLocation.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >Map</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Log Status Update Form */}
        {showLogForm && lead && (
          <LogStatusUpdateForm
            lead={lead}
            onClose={() => setShowLogForm(false)}
          />
        )}

        {/* Set Reminder Dialog */}
        {showReminderDialog && lead && (
          <SetReminderDialog
            leadId={lead.id}
            leadDisplayName={`${lead.parentName} / ${lead.studentName}`}
            onClose={() => setShowReminderDialog(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
