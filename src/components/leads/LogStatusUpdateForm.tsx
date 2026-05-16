'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, MapPin, AlertTriangle, Loader2, Calendar } from 'lucide-react';
import { Lead, TenantConfig, ApproachType, StatusOption, GpsLocation } from '@/types';
import { logStatusUpdateViaCloudFunction } from '@/lib/cloud-functions';
import { captureGPS } from '@/lib/gps-capture';
import { useOfflineGuard } from '@/hooks/useOfflineGuard';
import { useToast } from '@/hooks/use-toast';

interface LogStatusUpdateFormProps {
  lead: Lead;
  onClose: () => void;
}

export function LogStatusUpdateForm({ lead, onClose }: LogStatusUpdateFormProps) {
  const { user } = useAuth();
  const { guardedMutation } = useOfflineGuard();
  const { toast } = useToast();
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [approachType, setApproachType] = useState<ApproachType>((lead as any).lastApproachType || 'PHONE');
  const [statusCode, setStatusCode] = useState(lead.lastStatusCode || '');
  const [comments, setComments] = useState('');
  const [joinedCollegeName, setJoinedCollegeName] = useState('');
  const [accompanyingMemberUid, setAccompanyingMemberUid] = useState('');
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [nextFollowupTime, setNextFollowupTime] = useState('');
  const [nextFollowupNote, setNextFollowupNote] = useState('');

  // Load tenant config for status options
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsubscribe: Unsubscribe = onSnapshot(
      doc(db, 'tenantConfig', user.tenantId),
      (doc) => {
        if (doc.exists()) setTenantConfig(doc.data() as TenantConfig);
      },
      (error) => {
        if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
          console.warn('Permission denied for tenantConfig — claims may not be synced yet');
          return;
        }
        console.warn('Snapshot listener error:', error.code || error.message);
      }
    );
    return () => unsubscribe();
  }, [user?.tenantId]);

  // Capture GPS for DOORSTEP/WALK_IN
  useEffect(() => {
    if (approachType === 'DOORSTEP' || approachType === 'WALK_IN') {
      setGpsError(null);
      captureGPS({ required: true })
        .then(loc => {
          setGpsLocation(loc);

        })
        .catch(err => setGpsError(err.message));
    } else {
      setGpsLocation(null);
      setGpsError(null);
    }
  }, [approachType]);

  const activeStatusOptions = tenantConfig?.statusOptions?.filter(o => o.active) || [];
  const activeCollegeOptions = tenantConfig?.joinedCollegeOptions?.filter(o => o.active) || [];

  const handleSubmit = async () => {
    if (!statusCode) return;

    // Block if GPS required but not captured
    const gpsRequired = approachType === 'DOORSTEP' || approachType === 'WALK_IN';
    if (gpsRequired && !gpsLocation) {
      setGpsError('GPS location is required for this approach type. Please enable location and retry.');
      return;
    }

    setSubmitting(true);
    try {
      let nextFollowupAt: any = undefined;
      if (nextFollowupDate) {
        const dateStr = nextFollowupTime 
          ? `${nextFollowupDate}T${nextFollowupTime}` 
          : `${nextFollowupDate}T09:00:00`;
        nextFollowupAt = new Date(dateStr).toISOString();
      }

      await guardedMutation(async () => {
        return logStatusUpdateViaCloudFunction({
          leadId: lead.id,
          approachType,
          statusCode,
          comments: comments || undefined,
          joinedCollegeName: joinedCollegeName || undefined,
          accompanyingMemberUid: accompanyingMemberUid || undefined,
          gpsLocation: gpsLocation ? {
            lat: gpsLocation.lat,
            lng: gpsLocation.lng,
            accuracyMeters: gpsLocation.accuracyMeters,
            capturedAt: gpsLocation.capturedAt.toISOString(),
          } : undefined,
          gpsRequired,
          gpsCaptured: !!gpsLocation,
          nextFollowupAt,
          nextFollowupNote: nextFollowupNote || undefined,
        });
      }, 'Logging update');

      onClose();
    } catch (error: any) {
      console.error('Failed to log status update:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Log Status Update</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {lead.parentName} / {lead.studentName} • {lead.uniqueLeadId}
          </p>
        </DialogHeader>

        {lead.lastStatusCode && (
          <div className="bg-slate-50 border rounded-lg p-3 mt-2 flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Status</span>
            <div className="flex items-center gap-2 mt-1">
              {lead.lastApproachType && (
                <Badge variant="outline" className="text-[10px] bg-white">
                  {lead.lastApproachType}
                </Badge>
              )}
              {lead.lastStatusLabel ? (
                <Badge variant="secondary" className="text-xs">
                  {lead.lastStatusLabel}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {lead.lastStatusCode}
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 pt-2">
          {/* Approach Type */}
          <div>
            <Label className="text-xs">Approach Type</Label>
            <Select value={approachType} onValueChange={(v) => setApproachType(v as ApproachType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHONE">📞 Phone</SelectItem>
                <SelectItem value="DOORSTEP">🏠 Doorstep</SelectItem>
                <SelectItem value="WALK_IN">🚶 Walk-in</SelectItem>
                <SelectItem value="ONLINE">💻 Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* GPS Status */}
          {(approachType === 'DOORSTEP' || approachType === 'WALK_IN') && (
            <div>
              {gpsLocation ? (
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Location attached securely.
                    {gpsError && <span className="text-amber-600 block mt-1">{gpsError}</span>}
                  </AlertDescription>
                </Alert>
              ) : gpsError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">{gpsError}</AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription className="text-xs">Capturing GPS location...</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusCode} onValueChange={setStatusCode}>
              <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
              <SelectContent>
                {activeStatusOptions.map(opt => (
                  <SelectItem key={opt.code} value={opt.code}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Joined College Name (if status relates to joining) */}
          {statusCode.includes('JOINED') && activeCollegeOptions.length > 0 && (
            <div>
              <Label className="text-xs">College</Label>
              <Select value={joinedCollegeName} onValueChange={setJoinedCollegeName}>
                <SelectTrigger><SelectValue placeholder="Select college..." /></SelectTrigger>
                <SelectContent>
                  {activeCollegeOptions.map(opt => (
                    <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Comments */}
          <div>
            <Label className="text-xs">Comments (max 2000 chars)</Label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value.slice(0, 2000))}
              placeholder="Add any notes..."
              rows={3}
            />
          </div>

          {/* Next Follow-up */}
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-xs font-semibold">Schedule Follow-up (optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={nextFollowupDate} onChange={(e) => setNextFollowupDate(e.target.value)} />
              <Input type="time" value={nextFollowupTime} onChange={(e) => setNextFollowupTime(e.target.value)} />
            </div>
            <Input
              placeholder="Follow-up note..."
              value={nextFollowupNote}
              onChange={(e) => setNextFollowupNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !statusCode || ((approachType === 'DOORSTEP' || approachType === 'WALK_IN') && !gpsLocation)} className="bg-emerald-600 hover:bg-emerald-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Activity className="h-4 w-4 mr-1" />}
            Log Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
