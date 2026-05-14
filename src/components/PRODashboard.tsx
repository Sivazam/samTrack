'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp, Query, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, Phone, MapPin, Clock, Bell, Search, 
  Calendar, User, Activity, LogOut, RefreshCw,
  DoorOpen, Wifi, Footprints, Globe
} from 'lucide-react';
import { LeadAssignment, Reminder, StatusUpdate, ApproachType } from '@/types';
import { format } from 'date-fns';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import { useOfflineGuard } from '@/hooks/useOfflineGuard';

const APPROACH_ICONS: Record<ApproachType, React.ReactNode> = {
  PHONE: <Phone className="h-3 w-3" />,
  DOORSTEP: <DoorOpen className="h-3 w-3" />,
  WALK_IN: <Footprints className="h-3 w-3" />,
  ONLINE: <Globe className="h-3 w-3" />,
};

export default function PRODashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState<LeadAssignment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // My Leads — onSnapshot
  useEffect(() => {
    if (!user?.uid || !user?.tenantId) return;

    const q = query(
      collection(db, 'leadAssignments'),
      where('tenantId', '==', user.tenantId),
      where('assignedPROUids', 'array-contains', user.uid),
      where('active', '==', true)
    );

    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadAssignment));
      setLeads(leadsList);
      setLoading(false);
    }, (error) => {
      console.error('Leads snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.tenantId]);

  // Today's Reminders — onSnapshot
  useEffect(() => {
    if (!user?.uid || !user?.tenantId) return;

    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const q = query(
      collection(db, 'reminders'),
      where('recipientUids', 'array-contains', user.uid),
      where('status', 'in', ['PENDING', 'SNOOZED']),
      where('dueAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      const reminderList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      setReminders(reminderList);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.tenantId]);

  // Recent Updates — collection group query
  useEffect(() => {
    if (!user?.uid || !user?.tenantId) return;

    const q = query(
      collection(db, 'statusUpdates'),
      where('loggedByUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      const updates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentUpdates(updates);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.tenantId]);

  // Filter leads by search query
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase().trim();
    return leads.filter(lead => {
      const searchStr = `${lead.parentName || ''} ${lead.studentName || ''} ${lead.uniqueLeadId || ''} ${lead.parentPhone || ''} ${lead.studentPhone || ''} ${lead.divisionName || ''}`;
      return searchStr.toLowerCase().includes(q);
    });
  }, [leads, searchQuery]);

  // Group leads by status
  const leadsByStatus = useMemo(() => {
    const groups: Record<string, LeadAssignment[]> = {};
    filteredLeads.forEach(lead => {
      const status = lead.lastStatusCode || 'NO_STATUS';
      if (!groups[status]) groups[status] = [];
      groups[status].push(lead);
    });
    return groups;
  }, [filteredLeads]);

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/(\d{5})(\d{5})/, '$1 $2');
  };

  const formatDate = (timestamp?: Timestamp | any) => {
    if (!timestamp) return '';
    const date = timestamp?.toDate?.() || timestamp;
    return format(date, 'dd MMM, hh:mm a');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Samhitha Admissions</h1>
            <p className="text-xs text-muted-foreground">{user?.displayName} • PRO</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Today's Reminders Widget */}
      {reminders.length > 0 && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Action Required Today ({reminders.length})
            </span>
          </div>
          <div className="space-y-2">
            {reminders.slice(0, 5).map(reminder => (
              <div
                key={reminder.id}
                className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setSelectedLeadId(reminder.leadId)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{reminder.leadDisplayName}</p>
                  {reminder.note && <p className="text-xs text-muted-foreground truncate">{reminder.note}</p>}
                </div>
                <Badge variant="outline" className="ml-2 text-xs shrink-0">
                  <Clock className="h-3 w-3 mr-1" />
                  {reminder.dueDateOnly ? 'Today' : formatDate(reminder.dueAt)}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[57px] z-30 bg-background border-b">
          <TabsList className="w-full grid grid-cols-3 h-11 rounded-none">
            <TabsTrigger value="leads" className="text-xs">
              <Users className="h-3 w-3 mr-1" /> My Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="updates" className="text-xs">
              <Activity className="h-3 w-3 mr-1" /> Updates
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs">
              <User className="h-3 w-3 mr-1" /> Profile
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leads" className="mt-0">
          {/* Search */}
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Leads List */}
          <ScrollArea className="h-[calc(100vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-sm">No leads assigned</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id}
                    className="px-4 py-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedLeadId(lead.leadId)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.parentName} / {lead.studentName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{lead.uniqueLeadId}</span>
                          {lead.parentPhone && (
                            <span className="text-xs text-muted-foreground">{formatPhone(lead.parentPhone)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{lead.divisionName}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {lead.lastStatusCode && (
                          <Badge variant="secondary" className="text-xs">{lead.lastStatusCode}</Badge>
                        )}
                        {lead.nextFollowupAt && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(lead.nextFollowupAt)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="updates" className="mt-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {recentUpdates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mb-2 opacity-30" />
                <p className="text-sm">No recent updates</p>
              </div>
            ) : (
              <div className="divide-y">
                {recentUpdates.map((update: any) => (
                  <div key={update.id} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {APPROACH_ICONS[update.approachType as ApproachType]}
                          <Badge variant="secondary" className="text-xs">{update.statusLabel || update.statusCode}</Badge>
                        </div>
                        {update.comments && (
                          <p className="text-sm text-muted-foreground mt-1">{update.comments}</p>
                        )}
                        {update.gpsCaptured && update.gpsLocation && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📍 {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(update.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="profile" className="mt-0">
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{user?.displayName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
                {user?.username && (
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-medium">@{user.username}</p>
                  </div>
                )}
                {user?.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{formatPhone(user.phone)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Tenant</p>
                  <p className="text-sm font-medium">{user?.tenantName || user?.tenantId}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Modal/Sheet */}
      {selectedLeadId && (
        <LeadDetailView
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
