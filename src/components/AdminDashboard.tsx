'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, orderBy, limit,
  Timestamp, Unsubscribe, doc, collectionGroup
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Home, Users, UserCog, Activity, MapPin, BarChart3, BellRing, Settings,
  LogOut, Phone, CheckCircle2, Clock, TrendingUp, GraduationCap, LayoutGrid,
  UserPlus, FileBarChart, Send, PlusCircle, ArrowUpRight, ArrowDownRight,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TenantStats, Reminder } from '@/types';
import { format } from 'date-fns';
import { LeadsListView } from '@/components/leads/LeadsListView';
import { AreasManagement } from '@/components/areas/AreasManagement';
import { TeamsManagement } from '@/components/teams/TeamsManagement';
import { UserManagement } from '@/components/auth/UserManagement';
import { TenantConfigManagement } from '@/components/config/TenantConfigManagement';
import { ReportsPanel } from '@/components/reports/ReportsPanel';
import { RemindersWidget } from '@/components/reminders/RemindersWidget';
import { LogoutConfirmDialog } from '@/components/ui/LogoutConfirmDialog';

// ─── Navigation Configuration ────────────────────────────────────────────────

const PRIMARY_NAV = [
  { id: 'overview', label: 'Home', icon: Home },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'teams', label: 'Teams', icon: UserCog },
  { id: 'updates', label: 'Updates', icon: Activity },
  { id: 'more', label: 'More', icon: LayoutGrid },
] as const;

const MORE_NAV = [
  { id: 'divisions', label: 'Areas', icon: MapPin, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'users', label: 'Users', icon: UserCog, color: 'text-sky-600 bg-sky-50' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'text-teal-600 bg-teal-50' },
  { id: 'reminders', label: 'Reminders', icon: BellRing, color: 'text-amber-600 bg-amber-50' },
  { id: 'config', label: 'Config', icon: Settings, color: 'text-slate-600 bg-slate-100' },
] as const;

const SECTION_LABELS: Record<string, string> = {
  overview: 'Home',
  leads: 'Leads',
  teams: 'Teams',
  updates: 'Updates',
  divisions: 'Areas',
  users: 'Users',
  reports: 'Reports',
  reminders: 'Reminders',
  config: 'Config',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [todayReminders, setTodayReminders] = useState<Reminder[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);

  // ─── Firestore Listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsubscribe: Unsubscribe = onSnapshot(
      doc(db, 'tenant_stats', user.tenantId),
      (docSnap) => {
        if (docSnap.exists()) setStats(docSnap.data() as TenantStats);
      },
      (error) => {
        console.warn('Snapshot listener error:', error.code || error.message);
      }
    );
    return () => unsubscribe();
  }, [user?.tenantId]);

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
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setRecentUpdates([]);
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const q = query(
      collection(db, 'reminders'),
      where('tenantId', '==', user.tenantId),
      where('status', 'in', ['PENDING', 'SENT']),
      where('dueAt', '<=', Timestamp.fromDate(endOfDay)),
      orderBy('dueAt', 'asc')
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setTodayReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setTodayReminders([]);
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

  // Live tenant-wide leadAssignments — source of truth for accurate KPIs.
  // Each assignment carries lastStatusCode, nextFollowupAt, active, teamId, divisionId.
  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(
      collection(db, 'leadAssignments'),
      where('tenantId', '==', user.tenantId)
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setAllAssignments(snapshot.docs.map(d => d.data() as any));
    }, (error) => {
      console.warn('Assignments listener error:', error.code || error.message);
      setAllAssignments([]);
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const formatDate = (timestamp?: Timestamp | any) => {
    if (!timestamp) return '\u2014';
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp);
      if (!(date instanceof Date) || isNaN(date.getTime())) return '\u2014';
      return format(date, 'dd MMM, hh:mm a');
    } catch {
      return '\u2014';
    }
  };

  const userInitials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() || 'A');

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Admin';

  // ─── Computed (live, from leadAssignments — single source of truth) ─────
  // The legacy tenant_stats counters for byStatusCounts / joinedSamhithaCount /
  // followupsDueToday are not maintained by any trigger, so we recompute here.
  const computed = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let totalLeads = 0;
    let activeLeads = 0;
    let hotLeads = 0;            // WILLING_* + WAITING_* + REVISIT_NEEDED
    let willingCount = 0;        // WILLING_* only
    let waitingCount = 0;        // WAITING_* only
    let revisitCount = 0;        // REVISIT_NEEDED
    let joinedSamhitha = 0;
    let joinedOther = 0;
    let notWilling = 0;          // NOT_INTERESTED_*
    let followupsDueToday = 0;
    let followupsOverdue = 0;

    for (const a of allAssignments) {
      totalLeads++;
      if (a.active !== false) activeLeads++;
      const code: string = a.lastStatusCode || '';

      if (code.startsWith('WILLING_')) { willingCount++; hotLeads++; }
      else if (code.startsWith('WAITING_')) { waitingCount++; hotLeads++; }
      else if (code === 'REVISIT_NEEDED') { revisitCount++; hotLeads++; }
      else if (code === 'JOINED_SAMHITHA') joinedSamhitha++;
      else if (code === 'JOINED_OTHER') joinedOther++;
      else if (code.startsWith('NOT_INTERESTED_')) notWilling++;

      const due = a.nextFollowupAt?.toDate?.();
      if (due) {
        if (due >= startOfDay && due <= endOfToday) followupsDueToday++;
        else if (due < startOfDay) followupsOverdue++;
      }
    }
    return {
      totalLeads, activeLeads, hotLeads, willingCount, waitingCount, revisitCount,
      joinedSamhitha, joinedOther, notWilling, followupsDueToday, followupsOverdue,
    };
  }, [allAssignments]);

  const reminderCount = todayReminders.length;

  // ─── Animation Variants ─────────────────────────────────────────────────

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
  const itemVariant = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { ease: [0.25, 0.46, 0.45, 0.94] as const } } };

  // Smoother page transition variants
  const pageVariants = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.55, 0, 1, 0.45] as const } },
  };

  // ─── KPI Cards Config ───────────────────────────────────────────────────

  const kpiCards = [
    { label: 'Total Leads', value: computed.totalLeads, icon: Users, gradient: 'from-emerald-500 to-teal-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
    { label: 'Hot Leads', value: computed.hotLeads, icon: TrendingUp, gradient: 'from-sky-500 to-cyan-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
    { label: 'Joined', value: computed.joinedSamhitha, icon: CheckCircle2, gradient: 'from-emerald-400 to-emerald-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
    { label: 'Follow-ups', value: computed.followupsDueToday, icon: Clock, gradient: 'from-amber-400 to-orange-500', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
  ];

  // ─── Quick Actions Config ──────────────────────────────────────────────

  const quickActions = [
    { label: 'Add Lead', icon: UserPlus, action: () => handleTabChange('leads'), gradient: 'from-emerald-500 to-teal-500' },
    { label: 'Create Team', icon: UserCog, action: () => handleTabChange('teams'), gradient: 'from-teal-500 to-cyan-500' },
    { label: 'View Reports', icon: FileBarChart, action: () => handleTabChange('reports'), gradient: 'from-sky-500 to-blue-500' },
    { label: 'Send Reminder', icon: Send, action: () => handleTabChange('reminders'), gradient: 'from-amber-500 to-orange-500' },
    { label: 'Manage Areas', icon: MapPin, action: () => handleTabChange('divisions'), gradient: 'from-emerald-600 to-emerald-400' },
    { label: 'Add User', icon: PlusCircle, action: () => handleTabChange('users'), gradient: 'from-teal-600 to-sky-400' },
  ];

  // ─── Tab Handler ────────────────────────────────────────────────────────

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // ─── Skeleton KPI Card ─────────────────────────────────────────────────

  const SkeletonKPICard = () => (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="bg-gradient-to-br from-slate-200 to-slate-300 p-3.5 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-3 w-16 bg-white/30 mb-1.5" />
            <Skeleton className="h-7 w-10 bg-white/30" />
          </div>
          <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
        </div>
        <div className="flex items-end gap-[3px] mt-2 h-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 rounded-sm bg-white/15" style={{ height: `${20 + Math.random() * 40}%` }} />
          ))}
        </div>
      </div>
    </Card>
  );

  // ─── Skeleton Funnel ────────────────────────────────────────────────────

  const SkeletonFunnel = () => (
    <Card className="border-0 shadow-sm p-4">
      <Skeleton className="h-4 w-32 bg-slate-200 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-14 bg-slate-200 shrink-0" />
            <Skeleton className="h-6 rounded-md bg-slate-200" style={{ width: `${85 - i * 20}%` }} />
            <Skeleton className="h-3 w-8 bg-slate-200 shrink-0" />
          </div>
        ))}
      </div>
    </Card>
  );

  // ─── Overview Content ───────────────────────────────────────────────────

  const OverviewContent = () => {
    const isLoading = !stats;
    const totalLeads = computed.totalLeads;

    return (
      <div className="space-y-4 px-1">
        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
          className="pt-1"
        >
          <h2 className="text-lg font-bold text-slate-800">
            {getGreeting()}, <span className="text-emerald-600">{firstName}</span> 👋
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Here&apos;s what&apos;s happening with your admissions today
          </p>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3"
        >
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div key={`skel-${i}`} variants={itemVariant}>
                  <SkeletonKPICard />
                </motion.div>
              ))
            : kpiCards.map((card) => {
                const Icon = card.icon;
                const value = card.value ?? 0;
                return (
                  <motion.div
                    key={card.label}
                    variants={itemVariant}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Card className="relative overflow-hidden border-0 shadow-sm">
                      <div className={`bg-gradient-to-br ${card.gradient} p-3.5 rounded-xl`} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-medium text-white/80">{card.label}</p>
                            <p className="text-2xl font-bold text-white tracking-tight mt-0.5">{value}</p>
                          </div>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${card.iconBg}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
          }
        </motion.div>

        {/* Conversion Funnel */}
        {isLoading ? (
          <SkeletonFunnel />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                    <BarChart3 className="h-3.5 w-3.5 text-white" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-800">Conversion Funnel</CardTitle>
                </div>
              </div>
              <CardContent className="px-4 pb-4 pt-0">
                {(() => {
                  const funnelData = [
                    { label: 'Total', value: totalLeads, color: 'bg-emerald-500' },
                    { label: 'Active', value: computed.activeLeads, color: 'bg-sky-500' },
                    { label: 'Hot', value: computed.hotLeads, color: 'bg-teal-500' },
                    { label: 'Joined', value: computed.joinedSamhitha, color: 'bg-emerald-700' },
                  ];
                  const maxVal = Math.max(totalLeads, 1);
                  return (
                    <div className="space-y-2.5">
                      {funnelData.map((stage, idx) => {
                        const widthPct = Math.max((stage.value / maxVal) * 100, 2);
                        return (
                          <div key={stage.label} className="flex items-center gap-3">
                            <span className="text-[11px] font-medium text-slate-500 w-12 shrink-0">{stage.label}</span>
                            <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                              <motion.div
                                className={cn("h-full rounded-md", stage.color)}
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPct}%` }}
                                transition={{ duration: 0.6, delay: 0.1 * idx, ease: [0.22, 1, 0.36, 1] as const }}
                              />
                              {stage.value > 0 && (
                                <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-white drop-shadow-sm">
                                  {stage.value}
                                </span>
                              )}
                            </div>
                            {idx > 0 && totalLeads > 0 && (
                              <span className="text-[10px] text-slate-400 shrink-0 w-10 text-right">
                                {Math.round((stage.value / totalLeads) * 100)}%
                              </span>
                            )}
                            {idx === 0 && <span className="w-10" />}
                          </div>
                        );
                      })}
                      {/* Funnel connector text */}
                      {totalLeads > 0 && (
                        <div className="pt-1">
                          <p className="text-[11px] text-slate-400 text-center">
                            Overall conversion: <span className="font-semibold text-emerald-600">{Math.round((computed.joinedSamhitha / totalLeads) * 100)}%</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
                  <LayoutGrid className="h-3.5 w-3.5 text-white" />
                </div>
                <CardTitle className="text-sm font-semibold text-slate-800">Quick Actions</CardTitle>
              </div>
            </div>
            <CardContent className="px-3 pb-3 pt-0">
              <div className="grid grid-cols-3 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.label}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ y: -1 }}
                      onClick={action.action}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-sm transition-all group"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm",
                        action.gradient
                      )}>
                        <Icon className="h-4.5 w-4.5 text-white" />
                      </div>
                      <span className="text-[10px] font-medium text-slate-600 group-hover:text-emerald-700 transition-colors leading-tight text-center">
                        {action.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Today's Reminders */}
        <AnimatePresence>
          {todayReminders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-white" />
                    <span className="text-sm font-semibold text-white">Follow-ups Due Today</span>
                    <Badge className="bg-white/20 text-white hover:bg-white/20 text-xs border-0">{todayReminders.length}</Badge>
                  </div>
                </div>
                <CardContent className="p-2">
                  <div className="space-y-1">
                    {todayReminders.slice(0, 8).map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="truncate text-slate-700 text-xs font-medium">{reminder.leadDisplayName}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2 border-amber-200 text-amber-600">
                          {reminder.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Updates Feed */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                <TrendingUp className="h-3.5 w-3.5 text-white" />
              </div>
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {recentUpdates.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <Activity className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">No updates yet</p>
                <p className="text-xs text-slate-300 mt-1">Activity will appear here as leads are updated</p>
              </div>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-0.5"
              >
                {recentUpdates.slice(0, 15).map((update: any) => (
                  <motion.div
                    key={update.id}
                    variants={itemVariant}
                    className="flex items-start justify-between text-sm py-2 px-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-0 font-medium">{update.statusLabel || update.statusCode}</Badge>
                        <span className="text-[11px] text-slate-400">{update.loggedByName}</span>
                      </div>
                      {update.comments && <p className="text-xs text-slate-500 mt-0.5 truncate">{update.comments}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2 whitespace-nowrap">{formatDate(update.createdAt)}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── Updates Content ────────────────────────────────────────────────────

  const UpdatesContent = () => (
    <div className="px-1">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
              <TrendingUp className="h-3.5 w-3.5 text-white" />
            </div>
            <span>All Status Updates</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          {recentUpdates.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Activity className="h-5 w-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No updates yet</p>
              <p className="text-xs text-slate-300 mt-1">Status updates will appear here as they are logged</p>
            </div>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-4 px-1 pb-4 relative"
            >
              {/* Timeline line */}
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-100 z-0 hidden sm:block" />

              {recentUpdates.map((update: any) => (
                <motion.div
                  key={update.id}
                  variants={itemVariant}
                  className="flex flex-col gap-3 text-sm p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all relative z-10"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-0.5 shadow-sm">{update.statusLabel || update.statusCode}</Badge>
                      <Badge variant="outline" className="text-[11px] bg-sky-50 text-sky-800 border-sky-200 px-2.5 py-0.5 shadow-sm">{update.approachType}</Badge>
                      <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">{update.loggedByName}</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 shrink-0 ml-2 whitespace-nowrap bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">{formatDate(update.createdAt)}</span>
                  </div>
                  {update.comments && (
                    <div className="mt-1">
                      <p className="text-sm text-slate-700 bg-slate-50/80 p-3 rounded-lg border border-slate-100/80 italic">{update.comments}</p>
                    </div>
                  )}
                  {update.gpsCaptured && update.gpsLocation && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 text-sky-400" />
                      <p className="text-[10px] text-sky-600 font-mono">
                        {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        loading={loggingOut}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          try { await logout(); } finally { setLoggingOut(false); setShowLogoutConfirm(false); }
        }}
      />
      {/* ─── Sticky Header ──────────────────────────────────────────────── */}
      <header className="shrink-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500">
        <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 backdrop-blur-sm">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">Samhitha Admissions</h1>
              <p className="text-[10px] sm:text-xs text-emerald-100/80 font-medium truncate">
                {user?.tenantName || 'Admin'} &middot; {user?.role === 'MANAGER' ? 'Manager' : 'Admin'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop dashboard label */}
            <div className="hidden md:flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1">
              <BarChart3 className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[11px] text-white/80 font-medium">Dashboard</span>
            </div>
            <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur-sm text-white text-[10px] sm:text-xs font-bold ring-2 ring-white/20">
              {userInitials}
            </div>
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(true)} className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0">
                <LogOut className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* ─── Desktop Horizontal Nav (md+) ───────────────────────────────── */}
      <nav className="hidden md:block shrink-0 bg-white border-b border-slate-100 shadow-sm z-10 sticky top-0">
        <div className="max-w-7xl mx-auto flex items-center px-4 h-16 overflow-x-auto scrollbar-none snap-x snap-mandatory">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl my-auto">
            {[...PRIMARY_NAV.filter(n => n.id !== 'more'), ...MORE_NAV].map(navItem => {
              const Icon = navItem.icon;
              const isActive = activeTab === navItem.id;
              return (
                <button
                  key={navItem.id}
                  onClick={() => handleTabChange(navItem.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all duration-200 snap-start",
                    isActive
                      ? "text-emerald-700 bg-white shadow-sm ring-1 ring-black/5"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5", isActive ? "text-emerald-500" : "text-slate-400 group-hover:text-slate-500")} />
                  {navItem.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ─── Mobile Section Label Bar ───────────────────────────────────── */}
      <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-800">{SECTION_LABELS[activeTab] || 'Home'}</h2>
      </div>

      {/* ─── Content Area ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain">
        <div className="p-3 sm:p-4 pb-[76px] md:pb-4 min-h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {activeTab === 'overview' && <OverviewContent />}
              {activeTab === 'leads' && <LeadsListView />}
              {activeTab === 'divisions' && <AreasManagement />}
              {activeTab === 'teams' && <TeamsManagement />}
              {activeTab === 'users' && <UserManagement />}
              {activeTab === 'updates' && <UpdatesContent />}
              {activeTab === 'reports' && <ReportsPanel />}
              {activeTab === 'config' && <TenantConfigManagement />}
              {activeTab === 'reminders' && <RemindersWidget fullPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ─── Bottom Navigation Bar (mobile) ────────────────────────────── */}
      <nav className="md:hidden shrink-0 fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200/80">
        <div className="flex items-center justify-around h-[68px] px-2 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY_NAV.map((navItem) => {
            const Icon = navItem.icon;
            const isActive = navItem.id === 'more' ? moreOpen : activeTab === navItem.id;
            const showNotification = navItem.id === 'more' && reminderCount > 0;
            return (
              <motion.button
                key={navItem.id}
                onClick={() => {
                  if (navItem.id === 'more') {
                    setMoreOpen(true);
                  } else {
                    handleTabChange(navItem.id);
                  }
                }}
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 min-w-[56px] relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-x-2 top-1 bottom-1 rounded-2xl bg-emerald-50"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {/* Notification dot */}
                {showNotification && !isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-0.5 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white z-20"
                  />
                )}
                {showNotification && isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-0.5 right-3 w-2 h-2 bg-red-500 rounded-full ring-2 ring-emerald-50 z-20"
                  />
                )}
                <div className="relative z-10">
                  <Icon className={cn("h-5 w-5", isActive ? "text-emerald-600" : "text-slate-400")} />
                </div>
                <span className={cn("text-[10px] font-medium relative z-10", isActive ? "text-emerald-700" : "text-slate-400")}>
                  {navItem.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* ─── More Drawer (Sheet from bottom) ───────────────────────────── */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[60vh] p-0">
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          <SheetHeader className="px-5 pb-1 pt-1">
            <SheetTitle className="text-left text-base font-bold text-slate-900">More Options</SheetTitle>
            <p className="text-left text-xs text-slate-400 mt-0.5">Manage your organization</p>
          </SheetHeader>
          <Separator className="my-2" />
          <div className="grid grid-cols-3 gap-3 px-4 pb-6 pt-1">
            {MORE_NAV.map((navItem) => {
              const Icon = navItem.icon;
              const isActive = activeTab === navItem.id;
              const isReminders = navItem.id === 'reminders';
              return (
                <motion.button
                  key={navItem.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    handleTabChange(navItem.id);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all border relative",
                    isActive
                      ? "bg-emerald-50 border-emerald-200 shadow-sm"
                      : "bg-white border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50"
                  )}
                >
                  {/* Reminder badge on drawer item */}
                  {isReminders && reminderCount > 0 && (
                    <span className="absolute top-2 right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">
                      {reminderCount > 9 ? '9+' : reminderCount}
                    </span>
                  )}
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    isActive ? (navItem.color || 'bg-emerald-100') : 'bg-slate-50'
                  )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      isActive ? (navItem.color?.split(' ')[0] || 'text-emerald-700') : 'text-slate-400'
                    )} />
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-emerald-700" : "text-slate-600"
                  )}>{navItem.label}</span>
                  {isActive && (
                    <ChevronRight className="h-3 w-3 text-emerald-400 absolute bottom-2 right-2" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
