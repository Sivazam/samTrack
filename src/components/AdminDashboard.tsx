'use client';

import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, onSnapshot, orderBy, limit, 
  Timestamp, Unsubscribe, doc, getDoc, getDocs, collectionGroup 
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, Phone, MapPin, Clock, Bell, Search, 
  BarChart3, Settings, Building2, Activity,
  LogOut, Plus, RefreshCw, FileText, Calendar
} from 'lucide-react';
import { LeadAssignment, TenantStats, Reminder } from '@/types';
import { format } from 'date-fns';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { LeadsListView } from '@/components/leads/LeadsListView';
import { DivisionsManagement } from '@/components/divisions/DivisionsManagement';
import { TeamsManagement } from '@/components/teams/TeamsManagement';
import { UserManagement } from '@/components/auth/UserManagement';
import { TenantConfigManagement } from '@/components/config/TenantConfigManagement';
import { ReportsPanel } from '@/components/reports/ReportsPanel';
import { RemindersWidget } from '@/components/reminders/RemindersWidget';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);

  // Tenant Stats
  useEffect(() => {
    if (!user?.tenantId) return;
    const unsubscribe: Unsubscribe = onSnapshot(
      doc(db, 'tenant_stats', user.tenantId),
      (doc) => {
        if (doc.exists()) setStats(doc.data() as TenantStats);
      }
    );
    return () => unsubscribe();
  }, [user?.tenantId]);

  // Recent Updates (collection group query)
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(
      collectionGroup(db, 'statusUpdates'),
      where('tenantId', '==', user.tenantId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentUpdates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

  // Today's reminders
  useEffect(() => {
    if (!user?.tenantId) return;
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const q = query(
      collection(db, 'reminders'),
      where('tenantId', '==', user.tenantId),
      where('status', 'in', ['PENDING', 'SENT']),
      where('dueAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setTodayReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

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
            <p className="text-xs text-muted-foreground">
              {user?.tenantName || 'Admin'} • {user?.role === 'MANAGER' ? 'Manager' : 'Admin'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-[57px] z-30 bg-background border-b overflow-x-auto">
          <TabsList className="w-full h-11 rounded-none flex">
            <TabsTrigger value="overview" className="text-xs shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="leads" className="text-xs shrink-0">Leads</TabsTrigger>
            <TabsTrigger value="divisions" className="text-xs shrink-0">Divisions</TabsTrigger>
            <TabsTrigger value="teams" className="text-xs shrink-0">Teams</TabsTrigger>
            <TabsTrigger value="users" className="text-xs shrink-0">Users</TabsTrigger>
            <TabsTrigger value="updates" className="text-xs shrink-0">Updates</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs shrink-0">Reports</TabsTrigger>
            <TabsTrigger value="config" className="text-xs shrink-0">Config</TabsTrigger>
            <TabsTrigger value="reminders" className="text-xs shrink-0">Reminders</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 p-4 space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{stats?.totalLeads || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Active Leads</p>
                <p className="text-2xl font-bold">{stats?.totalActiveLeads || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Joined Samhitha</p>
                <p className="text-2xl font-bold text-green-600">{stats?.joinedSamhithaCount || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Follow-ups Today</p>
                <p className="text-2xl font-bold text-amber-600">{stats?.followupsDueToday || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Today's Reminders */}
          {todayReminders.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  Today&apos;s Follow-ups ({todayReminders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {todayReminders.slice(0, 10).map(reminder => (
                    <div key={reminder.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{reminder.leadDisplayName}</span>
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        {reminder.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Updates Feed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {recentUpdates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No updates yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentUpdates.map((update: any) => (
                      <div key={update.id} className="flex items-start justify-between text-sm border-b pb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{update.statusLabel || update.statusCode}</Badge>
                            <span className="text-xs text-muted-foreground">by {update.loggedByName}</span>
                          </div>
                          {update.comments && <p className="text-xs text-muted-foreground mt-1 truncate">{update.comments}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(update.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-0">
          <LeadsListView />
        </TabsContent>

        <TabsContent value="divisions" className="mt-0">
          <DivisionsManagement />
        </TabsContent>

        <TabsContent value="teams" className="mt-0">
          <TeamsManagement />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UserManagement />
        </TabsContent>

        <TabsContent value="updates" className="mt-0 p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Status Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh]">
                {recentUpdates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No updates</p>
                ) : (
                  <div className="space-y-2">
                    {recentUpdates.map((update: any) => (
                      <div key={update.id} className="flex items-start justify-between text-sm border-b pb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{update.statusLabel || update.statusCode}</Badge>
                            <Badge variant="outline" className="text-xs">{update.approachType}</Badge>
                            <span className="text-xs">by {update.loggedByName}</span>
                          </div>
                          {update.comments && <p className="text-xs text-muted-foreground mt-1">{update.comments}</p>}
                          {update.gpsCaptured && update.gpsLocation && (
                            <p className="text-xs text-blue-500 mt-1">
                              📍 {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)} (±{Math.round(update.gpsLocation.accuracyMeters)}m)
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDate(update.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ReportsPanel />
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          <TenantConfigManagement />
        </TabsContent>

        <TabsContent value="reminders" className="mt-0">
          <RemindersWidget fullPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
