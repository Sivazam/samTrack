'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, Unsubscribe, Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, MapPin, Clock, Calendar, User, Activity, X, Navigation,
  ExternalLink, Hash, BellRing, Clock4, Users, Globe, PhoneCall,
  MessageSquare, Home, Monitor, Footprints, Pencil
} from 'lucide-react';
import { Lead, StatusUpdate, ApproachType } from '@/types';
import { format } from 'date-fns';
import { LogStatusUpdateForm } from './LogStatusUpdateForm';
import { EditLeadForm } from './EditLeadForm';
import { SetReminderDialog } from '@/components/reminders/SetReminderDialog';
import { useAuth } from '@/contexts/AuthContext';

interface LeadDetailViewProps {
  leadId: string;
  onClose: () => void;
}

// Status color mapping for badges and timeline dots
const STATUS_DOT_COLORS: Record<string, string> = {
  JOINED_SAMHITHA: 'bg-emerald-500',
  WILLING_SAMHITHA: 'bg-emerald-400',
  JOINED_OTHER: 'bg-slate-400',
  WILLING_DEGREE: 'bg-sky-400',
  WILLING_OTHER_COLLEGE: 'bg-amber-400',
  NOT_INTERESTED_SAMHITHA: 'bg-red-400',
  NOT_INTERESTED_DEGREE: 'bg-red-400',
  NOT_DECIDED: 'bg-slate-400',
  WAITING_EAMCET: 'bg-blue-400',
  WAITING_NEET: 'bg-blue-400',
  PHONE_UNREACHABLE: 'bg-slate-300',
  NOT_ANSWERING: 'bg-slate-300',
  REVISIT_NEEDED: 'bg-orange-400',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  JOINED_SAMHITHA: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  WILLING_SAMHITHA: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  JOINED_OTHER: 'bg-slate-100 text-slate-600 border-slate-200',
  WILLING_DEGREE: 'bg-sky-50 text-sky-600 border-sky-100',
  WILLING_OTHER_COLLEGE: 'bg-amber-50 text-amber-600 border-amber-100',
  NOT_INTERESTED_SAMHITHA: 'bg-red-50 text-red-600 border-red-100',
  NOT_INTERESTED_DEGREE: 'bg-red-50 text-red-600 border-red-100',
  NOT_DECIDED: 'bg-slate-100 text-slate-500 border-slate-200',
  WAITING_EAMCET: 'bg-blue-50 text-blue-600 border-blue-100',
  WAITING_NEET: 'bg-blue-50 text-blue-600 border-blue-100',
  PHONE_UNREACHABLE: 'bg-slate-100 text-slate-500 border-slate-200',
  NOT_ANSWERING: 'bg-slate-100 text-slate-500 border-slate-200',
  REVISIT_NEEDED: 'bg-orange-50 text-orange-600 border-orange-100',
};

// Approach icon components
const APPROACH_ICONS: Record<ApproachType, React.ReactNode> = {
  PHONE: <Phone className="h-3.5 w-3.5" />,
  DOORSTEP: <Home className="h-3.5 w-3.5" />,
  WALK_IN: <Footprints className="h-3.5 w-3.5" />,
  ONLINE: <Monitor className="h-3.5 w-3.5" />,
};

const APPROACH_LABELS: Record<ApproachType, string> = {
  PHONE: 'Phone',
  DOORSTEP: 'Doorstep',
  WALK_IN: 'Walk-in',
  ONLINE: 'Online',
};

const APPROACH_BG: Record<ApproachType, string> = {
  PHONE: 'bg-sky-50 text-sky-600 border-sky-100',
  DOORSTEP: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  WALK_IN: 'bg-teal-50 text-teal-600 border-teal-100',
  ONLINE: 'bg-slate-50 text-slate-600 border-slate-100',
};

export function LeadDetailView({ leadId, onClose }: LeadDetailViewProps) {
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);

  // Lead onSnapshot
  useEffect(() => {
    const unsubscribe: Unsubscribe = onSnapshot(doc(db, 'leads', leadId), (doc) => {
      if (doc.exists()) setLead({ id: doc.id, ...doc.data() } as Lead);
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
    });
    return () => unsubscribe();
  }, [leadId]);

  // Status updates onSnapshot
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(
      collection(db, 'leads', leadId, 'statusUpdates'),
      where('tenantId', '==', user.tenantId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setStatusUpdates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StatusUpdate)));
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setStatusUpdates([]);
    });
    return () => unsubscribe();
  }, [leadId]);

  const formatPhone = (phone?: string) => phone?.replace(/(\d{5})(\d{5})/, '$1 $2') || '';
  const formatDate = (ts?: Timestamp | any) => {
    if (!ts) return '';
    return format(ts?.toDate?.() || ts, 'dd MMM yyyy, hh:mm a');
  };
  const formatShortDate = (ts?: Timestamp | any) => {
    if (!ts) return '';
    return format(ts?.toDate?.() || ts, 'dd MMM yyyy');
  };
  const formatTime = (ts?: Timestamp | any) => {
    if (!ts) return '';
    return format(ts?.toDate?.() || ts, 'hh:mm a');
  };

  // Status badge color
  const getStatusBadge = (statusCode: string) =>
    STATUS_BADGE_COLORS[statusCode] || 'bg-slate-100 text-slate-600 border-slate-200';

  // Dot color for timeline
  const getDotColor = (statusCode: string) =>
    STATUS_DOT_COLORS[statusCode] || 'bg-slate-400';

  // Assigned PRO names (from assignedPROUids)
  const proCount = lead?.assignedPROUids?.length || 0;

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 overflow-hidden [&>button]:text-white [&>button]:opacity-100 [&>button]:bg-white/20 hover:[&>button]:bg-white/30 [&>button]:backdrop-blur-sm [&>button]:rounded-full [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button>svg]:h-4 [&>button>svg]:w-4 [&>button]:top-3 [&>button]:right-3">
        <SheetTitle className="sr-only">Lead Details - {lead?.studentName}</SheetTitle>
        {/* Gradient Header */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 px-5 pt-5 pb-8">
          {lead ? (
            <div className="space-y-3">
              {/* Student name prominently */}
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">{lead.studentName}</h2>
                <p className="text-emerald-100 text-sm mt-0.5">
                  <span className="text-emerald-200">Parent:</span> {lead.parentName}
                </p>
              </div>

              {/* ID Badge + Status Badge row */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                  <Hash className="h-3.5 w-3.5 text-emerald-200" />
                  <span className="text-sm font-mono text-white font-medium">{lead.uniqueLeadId}</span>
                </div>
                {lead.lastStatusCode && (
                  <Badge className={`text-xs border font-medium ${getStatusBadge(lead.lastStatusCode)}`}>
                    {lead.lastStatusLabel || lead.lastStatusCode}
                  </Badge>
                )}
              </div>

              {/* Area Badge */}
              {lead.divisionName && (
                <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-200" />
                  <span className="text-sm text-white">{lead.divisionName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-6 w-40 bg-white/20 rounded animate-pulse" />
              <div className="h-4 w-28 bg-white/15 rounded animate-pulse" />
            </div>
          )}
        </div>

        {/* Contact Actions Bar */}
        {lead && (
          <div className="flex gap-2 px-4 -mt-4">
            {lead.parentPhone && (
              <a
                href={`tel:${lead.parentPhone}`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white rounded-xl shadow-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-slate-100"
              >
                <PhoneCall className="h-4 w-4 text-emerald-600" />
                <span>Parent</span>
              </a>
            )}
            {lead.studentPhone && (
              <a
                href={`tel:${lead.studentPhone}`}
                className="flex-1 flex items-center justify-center gap-1.5 bg-white rounded-xl shadow-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-slate-100"
              >
                <PhoneCall className="h-4 w-4 text-teal-500" />
                <span>Student</span>
              </a>
            )}
            {!lead.parentPhone && !lead.studentPhone && (
              <div className="flex-1 flex items-center justify-center gap-1.5 bg-white rounded-xl shadow-md px-3 py-2.5 text-sm text-slate-400 border border-slate-100">
                <Phone className="h-4 w-4" />
                <span>No phone</span>
              </div>
            )}
          </div>
        )}

        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-5">

            {/* Lead Details Card */}
            {lead && (
              <Card className="border-slate-200/60 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Parent</span>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{lead.parentName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Student</span>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{lead.studentName}</p>
                    </div>
                    {lead.parentPhone && (
                      <div>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Parent Phone</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{formatPhone(lead.parentPhone)}</p>
                      </div>
                    )}
                    {lead.studentPhone && (
                      <div>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Student Phone</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{formatPhone(lead.studentPhone)}</p>
                      </div>
                    )}
                    {lead.intermediateGroup && (
                      <div>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Group</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{lead.intermediateGroup}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Area</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                        <p className="text-sm font-medium text-slate-800">{lead.divisionName}</p>
                      </div>
                    </div>
                    {lead.joinedCollegeName && (
                      <div>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">College Joined</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{lead.joinedCollegeName}</p>
                      </div>
                    )}
                  </div>
                  {lead.address && (
                    <div className="pt-1 border-t border-slate-100">
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Address</span>
                      <p className="text-sm text-slate-700 mt-0.5">{lead.address}</p>
                    </div>
                  )}
                  {lead.nextFollowupAt && (
                    <div className="pt-1 border-t border-slate-100">
                      <Badge variant="outline" className="text-xs border-emerald-200 text-emerald-700 bg-emerald-50/50">
                        <Calendar className="h-3 w-3 mr-1" />
                        Follow-up: {formatDate(lead.nextFollowupAt)}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* GPS Map Link */}
            {lead && statusUpdates.length > 0 && statusUpdates.some(u => u.gpsCaptured && u.gpsLocation) && (() => {
              const latestGpsUpdate = statusUpdates.find(u => u.gpsCaptured && u.gpsLocation);
              if (!latestGpsUpdate?.gpsLocation) return null;
              const { lat, lng } = latestGpsUpdate.gpsLocation;
              return (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-teal-50 border border-sky-100 hover:from-sky-100 hover:to-teal-100 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                    <Globe className="h-5 w-5 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">View on Map</p>
                    <p className="text-xs text-slate-500">
                      {lat.toFixed(4)}, {lng.toFixed(4)} (±{Math.round(latestGpsUpdate.gpsLocation.accuracyMeters)}m)
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-sky-500" />
                </a>
              );
            })()}

            {/* Action Buttons - Enhanced */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-md shadow-emerald-200/50 h-11"
                  onClick={() => setShowLogForm(true)}
                >
                  <Activity className="h-4 w-4 mr-2" /> Log Update
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11 shadow-sm"
                  onClick={() => setShowReminderDialog(true)}
                >
                  <BellRing className="h-4 w-4 mr-2" /> Set Reminder
                </Button>
              </div>
              {user && (user.role === 'COLLEGE_ADMIN' || user.role === 'MANAGER') && (
                <Button
                  variant="outline"
                  className="w-full border-slate-200 text-slate-600 hover:bg-slate-50 h-9 text-sm"
                  onClick={() => setShowEditForm(true)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Lead Details
                </Button>
              )}
            </div>

            {/* Lead Metadata */}
            {lead && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Clock4 className="h-3 w-3" />
                  Created: {formatShortDate(lead.createdAt)}
                </div>
                <span className="text-slate-200">|</span>
                <div className="flex items-center gap-1">
                  <Clock4 className="h-3 w-3" />
                  Updated: {formatShortDate(lead.updatedAt)}
                </div>
                {proCount > 0 && (
                  <>
                    <span className="text-slate-200">|</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {proCount} PRO{proCount > 1 ? 's' : ''}
                    </div>
                  </>
                )}
              </div>
            )}

            <Separator className="bg-slate-100" />

            {/* Timeline-style Status History */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                Status History
                {statusUpdates.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                    {statusUpdates.length}
                  </Badge>
                )}
              </h3>

              <AnimatePresence mode="wait">
                {statusUpdates.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center py-8 text-slate-300"
                  >
                    <Activity className="h-10 w-10 mb-2" />
                    <p className="text-sm">No updates yet</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="timeline"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative"
                  >
                    {/* Vertical timeline line */}
                    <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200" />

                    <div className="space-y-4">
                      {statusUpdates.map((update, index) => (
                        <motion.div
                          key={update.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="relative flex gap-3"
                        >
                          {/* Timeline dot */}
                          <div className="relative z-10 mt-1.5 shrink-0">
                            <div className={`h-[18px] w-[18px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${getDotColor(update.statusCode)}`}>
                              {index === 0 && (
                                <span className="absolute h-[18px] w-[18px] rounded-full animate-ping opacity-30 bg-current" />
                              )}
                            </div>
                          </div>

                          {/* Update card */}
                          <div className={`flex-1 rounded-xl border p-3 bg-white shadow-sm ${index === 0 ? 'border-emerald-100 shadow-emerald-100/30' : 'border-slate-100'}`}>
                            {/* Status + Approach row */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge className={`text-[10px] border font-medium ${getStatusBadge(update.statusCode)}`}>
                                  {update.statusLabel || update.statusCode}
                                </Badge>
                                <Badge variant="outline" className={`text-[10px] border ${APPROACH_BG[update.approachType] || 'border-slate-200 text-slate-600'}`}>
                                  <span className="mr-1">{APPROACH_ICONS[update.approachType]}</span>
                                  {APPROACH_LABELS[update.approachType]}
                                </Badge>
                              </div>
                            </div>

                            {/* Timestamp */}
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                              <Calendar className="h-3 w-3" />
                              {formatShortDate(update.createdAt)}
                              <Clock4 className="h-3 w-3 ml-1" />
                              {formatTime(update.createdAt)}
                            </div>

                            {/* Comments */}
                            {update.comments && (
                              <p className="text-sm text-slate-700 mt-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
                                {update.comments}
                              </p>
                            )}

                            {/* Logged by */}
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                              <User className="h-3 w-3" />
                              {update.loggedByName}
                              {update.accompanyingMemberName && (
                                <span className="text-slate-300">+</span>
                              )}
                              {update.accompanyingMemberName}
                            </div>

                            {/* GPS inline link */}
                            {update.gpsCaptured && update.gpsLocation && (
                              <div className="flex items-center gap-1.5 mt-2 text-xs">
                                <a
                                  href={`https://www.google.com/maps?q=${update.gpsLocation.lat},${update.gpsLocation.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sky-500 hover:text-sky-600 transition-colors"
                                >
                                  <Navigation className="h-3 w-3" />
                                  {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                                <span className="text-slate-300">(±{Math.round(update.gpsLocation.accuracyMeters)}m)</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

        {/* Edit Lead Form */}
        {showEditForm && lead && (
          <EditLeadForm
            lead={lead}
            onClose={() => setShowEditForm(false)}
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
