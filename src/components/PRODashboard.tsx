'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, collectionGroup, query, where, onSnapshot, orderBy, limit, Timestamp, Unsubscribe, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Users, Phone, MapPin, Clock, Bell, Search,
  Calendar, User, Activity, LogOut, RefreshCw,
  DoorOpen, Wifi, Footprints, Globe, UserCheck, GraduationCap,
  ChevronRight, Mail, Building2, AlertCircle, TrendingUp,
  BarChart3, Home, AlertTriangle, BookOpen, Layers, ClipboardList, Check,
  Plus, Tag, AlarmClock, X
} from 'lucide-react';
import { LeadAssignment, Reminder, ApproachType } from '@/types';
import { format } from 'date-fns';
import { LeadDetailView } from '@/components/leads/LeadDetailView';
import { LogoutConfirmDialog } from '@/components/ui/LogoutConfirmDialog';
import { updateUserViaCloudFunction, manageReminderViaCloudFunction } from '@/lib/cloud-functions';
import { ProAddLeadForm } from '@/components/leads/ProAddLeadForm';
import * as XLSX from 'xlsx';

// ─── Approach Type Config ────────────────────────────────────────────────────
const APPROACH_ICONS: Record<ApproachType, React.ReactNode> = {
  PHONE: <Phone className="h-3.5 w-3.5" />,
  DOORSTEP: <DoorOpen className="h-3.5 w-3.5" />,
  WALK_IN: <Footprints className="h-3.5 w-3.5" />,
  ONLINE: <Globe className="h-3.5 w-3.5" />,
};

// FIX: Replaced violet-50/violet-600 with teal-50/teal-600 for WALK_IN
const APPROACH_COLORS: Record<ApproachType, string> = {
  PHONE: 'bg-sky-50 text-sky-600 border-sky-100',
  DOORSTEP: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  WALK_IN: 'bg-teal-50 text-teal-600 border-teal-100',
  ONLINE: 'bg-blue-50 text-blue-600 border-blue-100',
};

const APPROACH_CIRCLE_COLORS: Record<ApproachType, string> = {
  PHONE: 'bg-sky-100 text-sky-600',
  DOORSTEP: 'bg-emerald-100 text-emerald-600',
  WALK_IN: 'bg-teal-100 text-teal-600',
  ONLINE: 'bg-blue-100 text-blue-600',
};

// ─── Status Color Mapping ────────────────────────────────────────────────────
// Maps status code patterns to border/badge/funnel colors
const STATUS_BORDER_COLORS: Record<string, string> = {
  JOINED: 'border-l-emerald-500',
  WILLING: 'border-l-emerald-400',
  REVISIT: 'border-l-orange-400',
  NOT_INTERESTED: 'border-l-red-400',
  WAITING: 'border-l-sky-400',
  UNREACHABLE: 'border-l-slate-300',
  NOT_DECIDED: 'border-l-slate-300',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  JOINED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WILLING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REVISIT: 'bg-orange-50 text-orange-700 border-orange-200',
  NOT_INTERESTED: 'bg-red-50 text-red-700 border-red-200',
  WAITING: 'bg-sky-50 text-sky-700 border-sky-200',
  UNREACHABLE: 'bg-slate-50 text-slate-600 border-slate-200',
  NOT_DECIDED: 'bg-slate-50 text-slate-600 border-slate-200',
};

const STATUS_FUNNEL_COLORS: Record<string, string> = {
  JOINED: 'bg-emerald-500',
  WILLING: 'bg-emerald-400',
  REVISIT: 'bg-orange-400',
  NOT_INTERESTED: 'bg-red-400',
  WAITING: 'bg-sky-400',
  UNREACHABLE: 'bg-slate-300',
  NOT_DECIDED: 'bg-slate-300',
};

// Order for funnel display (most positive first)
const STATUS_FUNNEL_ORDER = ['JOINED', 'WILLING', 'WAITING', 'REVISIT', 'NOT_DECIDED', 'NOT_INTERESTED', 'UNREACHABLE'];

function getStatusKey(statusCode?: string): string {
  if (!statusCode) return 'UNKNOWN';
  const upper = statusCode.toUpperCase();
  for (const key of STATUS_FUNNEL_ORDER) {
    if (upper.includes(key)) return key;
  }
  return 'UNKNOWN';
}

function getBorderColor(statusCode?: string): string {
  const key = getStatusKey(statusCode);
  return STATUS_BORDER_COLORS[key] || 'border-l-slate-200';
}

function getBadgeColor(statusCode?: string): string {
  const key = getStatusKey(statusCode);
  return STATUS_BADGE_COLORS[key] || 'bg-slate-50 text-slate-600 border-slate-200';
}

function getFunnelColor(statusCode?: string): string {
  const key = getStatusKey(statusCode);
  return STATUS_FUNNEL_COLORS[key] || 'bg-slate-200';
}

function isOverdue(timestamp?: Timestamp | any): boolean {
  if (!timestamp) return false;
  try {
    const date = timestamp?.toDate?.() || timestamp;
    return date < new Date();
  } catch {
    return false;
  }
}

// ─── Animation Variants ──────────────────────────────────────────────────────
const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

const floatAnimation = {
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
} as const;

// ─── Component ───────────────────────────────────────────────────────────────
export default function PRODashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState<LeadAssignment[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [referralFilter, setReferralFilter] = useState(false);
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  const [reminderActionLoading, setReminderActionLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Profile edit states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Day Sheet states
  const [daySheetDate, setDaySheetDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [daySheetUpdates, setDaySheetUpdates] = useState<any[]>([]);
  const [daySheetLoading, setDaySheetLoading] = useState(false);
  const [daySheetApproachFilter, setDaySheetApproachFilter] = useState<string>('ALL');

  // My Leads — only leads where this PRO's UID is in assignedPROUids.
  // This is the authoritative check: leads are assigned to PROs when a team covers
  // an area, or when a lead is created in an area that has a team.
  useEffect(() => {
    if (!user?.uid || !user?.tenantId) return;

    const q = query(
      collection(db, 'leadAssignments'),
      where('tenantId', '==', user.tenantId),
      where('assignedPROUids', 'array-contains', user.uid),
      where('active', '==', true)
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadAssignment)));
      setLoading(false);
    }, (error) => {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission-denied')) {
        console.warn('Permission denied for leadAssignments — claims may not be synced yet');
        setLeads([]);
        setLoading(false);
        return;
      }
      console.warn('Leads snapshot error:', error.code || error.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid, user?.tenantId]);

  // Reminders — all upcoming (today + future) + recently fired, for this PRO
  useEffect(() => {
    if (!user?.uid || !user?.tenantId) return;
    // Show pending/sent/snoozed reminders. We do NOT cap by dueAt so future
    // reminders set via "Set Reminder" or Log Update Form appear immediately.
    // NOTE: We deliberately omit orderBy in the Firestore query (sort client-side)
    // to sidestep any composite-index requirement for (array-contains + in + orderBy).
    const q = query(
      collection(db, 'reminders'),
      where('tenantId', '==', user.tenantId),
      where('recipientUids', 'array-contains', user.uid),
      where('status', 'in', ['PENDING', 'SENT', 'SNOOZED']),
      limit(200)
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      list.sort((a: any, b: any) => {
        const ta = a.dueAt?.toDate?.()?.getTime?.() ?? 0;
        const tb = b.dueAt?.toDate?.()?.getTime?.() ?? 0;
        return ta - tb;
      });
      setReminders(list);
    }, (error) => {
      console.error('[PRODashboard] Reminders listener error:', error?.code, error?.message, error);
      setReminders([]);
    });
    return () => unsubscribe();
  }, [user?.uid, user?.tenantId]);

  // Recent Updates
  useEffect(() => {
    if (!user?.uid || !user?.tenantId) return;
    const q = query(
      collectionGroup(db, 'statusUpdates'),
      where('tenantId', '==', user.tenantId),
      where('loggedByUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentUpdates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setRecentUpdates([]);
    });
    return () => unsubscribe();
  }, [user?.uid, user?.tenantId]);

  // Day Sheet — fetch status updates for selected date
  useEffect(() => {
    if (!user?.uid || !user?.tenantId || !daySheetDate) return;

    const fetchDaySheet = async () => {
      setDaySheetLoading(true);
      try {
        const [year, month, day] = daySheetDate.split('-').map(Number);
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

        const q = query(
          collectionGroup(db, 'statusUpdates'),
          where('tenantId', '==', user.tenantId),
          where('loggedByUid', '==', user.uid),
          where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
          where('createdAt', '<=', Timestamp.fromDate(endOfDay)),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        setDaySheetUpdates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error('Day sheet query error:', error);
        setDaySheetUpdates([]);
      } finally {
        setDaySheetLoading(false);
      }
    };

    fetchDaySheet();
  }, [user?.uid, user?.tenantId, daySheetDate]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // Simulate refresh - data will auto-update via onSnapshot, just show animation
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;
    
    // Filter referral leads only
    if (referralFilter) {
      result = result.filter(lead => (lead as any).isReferral === true);
    }
    
    // Filter by Division/Area if areaFilter is set
    if (areaFilter) {
      result = result.filter(lead => lead.divisionId === areaFilter || lead.divisionName?.toLowerCase() === areaFilter.toLowerCase());
    }

    // Filter by text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(lead => {
        const searchStr = `${lead.parentName || ''} ${lead.studentName || ''} ${lead.uniqueLeadId || ''} ${lead.parentPhone || ''} ${lead.studentPhone || ''} ${lead.divisionName || ''}`;
        return searchStr.toLowerCase().includes(q);
      });
    }

    return result;
  }, [leads, searchQuery, areaFilter, referralFilter]);

  // Overall lead summary stats (across all leads, not filtered)
  const leadStats = useMemo(() => {
    const total = leads.length;
    const visited = leads.filter(l => l.lastStatusCode && l.lastStatusCode !== 'NEW').length;
    const remaining = total - visited;
    const referralCount = leads.filter(l => (l as any).isReferral === true).length;
    return { total, visited, remaining, referralCount };
  }, [leads]);

  // Derived unique areas assigned to the PRO (for the filter dropdown)
  const assignedAreas = useMemo(() => {
    const areas = new Set<string>();
    leads.forEach(lead => {
      if (lead.divisionName) areas.add(lead.divisionName);
    });
    return Array.from(areas).sort();
  }, [leads]);

  // Status funnel computation
  const statusFunnel = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(lead => {
      const key = getStatusKey(lead.lastStatusCode);
      counts[key] = (counts[key] || 0) + 1;
    });
    // Sort by funnel order
    return STATUS_FUNNEL_ORDER
      .filter(k => counts[k])
      .map(k => ({ key: k, count: counts[k], color: STATUS_FUNNEL_COLORS[k] || 'bg-slate-200' }))
      .concat(
        Object.entries(counts)
          .filter(([k]) => !STATUS_FUNNEL_ORDER.includes(k))
          .map(([key, count]) => ({ key, count, color: 'bg-slate-200' }))
      );
  }, [leads]);

  // Lead name lookup map for day sheet
  const leadNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    leads.forEach(lead => {
      map[lead.leadId] = lead.studentName
        ? `${lead.studentName} / ${lead.parentName}`
        : lead.parentName || lead.uniqueLeadId;
    });
    return map;
  }, [leads]);

  // Day sheet summary stats
  const daySheetSummary = useMemo(() => {
    const updates = daySheetUpdates;
    const calls = updates.filter((u: any) => u.approachType === 'PHONE').length;
    const visits = updates.filter((u: any) => u.approachType === 'DOORSTEP').length;
    const online = updates.filter((u: any) => u.approachType === 'ONLINE').length;
    const walkIn = updates.filter((u: any) => u.approachType === 'WALK_IN').length;
    const leadsUpdated = new Set(updates.map((u: any) => u.leadId)).size;
    return { calls, visits, online, walkIn, total: updates.length, leadsUpdated };
  }, [daySheetUpdates]);

  // Filtered day sheet updates
  const filteredDaySheetUpdates = useMemo(() => {
    if (daySheetApproachFilter === 'ALL') return daySheetUpdates;
    return daySheetUpdates.filter((u: any) => u.approachType === daySheetApproachFilter);
  }, [daySheetUpdates, daySheetApproachFilter]);

  // Today's reminders (for home banner + leads tab)
  const todayReminders = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
    return reminders.filter((r: any) => {
      try {
        const d = r.dueAt?.toDate?.() || r.dueAt;
        const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
        return t >= startOfDay && t < endOfDay;
      } catch { return false; }
    });
  }, [reminders]);

  // Profile stats
  const profileStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updatesToday = recentUpdates.filter((u: any) => {
      try {
        const d = u.createdAt?.toDate?.() || u.createdAt;
        return d >= today;
      } catch { return false; }
    }).length;
    const pendingReminders = reminders.length;
    return { totalLeads: leads.length, updatesToday, pendingReminders };
  }, [leads, recentUpdates, reminders]);

  // Download day sheet as Excel with full lead details
  const downloadDaySheet = useCallback(() => {
    const headers = [
      'Time', 'Lead ID', 'Student Name', 'Parent Name', 'Parent Phone', 'Student Phone',
      'Area', 'Intermediate Group', 'Approach', 'Status', 'Comments',
      'Team Member 1', 'Team Member 2', 'Joined College Name',
    ];
    const rows = (filteredDaySheetUpdates as any[]).map(u => {
      const lead = leads.find(l => l.leadId === u.leadId);
      return [
        u.createdAt?.toDate ? format(u.createdAt.toDate(), 'hh:mm a') : '',
        lead?.uniqueLeadId || '',
        lead?.studentName || '',
        lead?.parentName || '',
        lead?.parentPhone || '',
        lead?.studentPhone || '',
        lead?.divisionName || '',
        u.intermediateGroup || '',
        u.approachType || '',
        u.statusLabel || u.statusCode || '',
        u.comments || '',
        u.loggedByName || user?.displayName || '',
        u.accompanyingMemberName || '',
        u.joinedCollegeName || '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Day Sheet');
    XLSX.writeFile(wb, `day-sheet-${user?.displayName?.replace(/\s+/g, '_') || 'PRO'}-${daySheetDate}.xlsx`);
  }, [filteredDaySheetUpdates, leads, daySheetDate, user?.displayName]);

  // Save profile
  const handleSaveProfile = useCallback(async () => {
    if (!user?.uid) return;
    setSavingProfile(true);
    setProfileError('');
    try {
      await updateUserViaCloudFunction({ userId: user.uid, displayName: editName.trim(), phone: editPhone.trim() || undefined });
      setEditProfileOpen(false);
    } catch (e: any) {
      setProfileError(e.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  }, [user?.uid, editName, editPhone]);

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/(\d{5})(\d{5})/, '$1 $2');
  };

  const formatDate = (timestamp?: Timestamp | any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp?.toDate?.() || timestamp;
      if (!(date instanceof Date) || isNaN(date.getTime())) return '—';
      return format(date, 'dd MMM, hh:mm a');
    } catch { return '—'; }
  };

  const formatShortDate = (timestamp?: Timestamp | any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp?.toDate?.() || timestamp;
      if (!(date instanceof Date) || isNaN(date.getTime())) return '';
      return format(date, 'dd MMM');
    } catch { return ''; }
  };

  const TAB_ITEMS = [
    { id: 'leads', label: 'Leads', icon: Users, count: leads.length },
    { id: 'updates', label: 'Updates', icon: Activity, count: recentUpdates.length },
    { id: 'reminders', label: 'Reminders', icon: Bell, count: reminders.length || undefined },
    { id: 'daysheet', label: 'Day Sheet', icon: ClipboardList },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
      {/* Logout Confirmation */}
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        loading={loggingOut}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          try { await logout(); } finally { setLoggingOut(false); setShowLogoutConfirm(false); }
        }}
      />

      {/* Add Referral Lead Form */}
      {showAddLeadForm && (
        <ProAddLeadForm onClose={() => setShowAddLeadForm(false)} />
      )}

      {/* Profile Edit Dialog */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="w-full max-w-sm bg-white rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">
              <h2 className="text-white font-bold text-base">Edit Profile</h2>
              <p className="text-emerald-100 text-xs mt-0.5">Update your display name and phone</p>
            </div>
            <div className="p-5 space-y-3">
              {profileError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{profileError}</p>}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Display Name</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-sm" placeholder="Your name" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Phone</label>
                <Input value={editPhone} onChange={e => setEditPhone(e.target.value.replace(/\D/g,''))} className="h-9 text-sm" placeholder="10-digit mobile" maxLength={10} inputMode="numeric" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditProfileOpen(false)} disabled={savingProfile}>Cancel</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveProfile} disabled={savingProfile || !editName.trim()}>
                  {savingProfile ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}Save
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-500">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-white/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Samhitha Admissions</h1>
              <p className="text-[10px] text-emerald-100/80 font-medium">{user?.displayName} &middot; PRO</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Pull-to-refresh button */}
            <motion.div whileTap={{ scale: 0.85 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-white/80 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </Button>
            </motion.div>
            <div className="h-7 w-7 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{user?.displayName?.charAt(0)?.toUpperCase() || 'P'}</span>
            </div>
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(true)} className="text-white/80 hover:text-white hover:bg-white/10 h-7 w-7 p-0">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      {/* ── Refreshing Indicator ──────────────────────────────────────── */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 3 }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 bg-emerald-500 overflow-hidden"
          >
            <motion.div
              className="h-full bg-white/40"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              style={{ width: '50%' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reminders Banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {todayReminders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 cursor-pointer"
            onClick={() => setActiveTab('reminders')}
          >
            <div className="flex items-center gap-2 px-4 py-2">
              <Bell className="h-3.5 w-3.5 text-white" />
              <span className="text-xs font-semibold text-white">{todayReminders.length} follow-up{todayReminders.length !== 1 ? 's' : ''} due today</span>
              <ChevronRight className="h-3.5 w-3.5 text-white/70 ml-auto" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop Tab Bar ───────────────────────────────────────────────────── */}
      <div className="hidden md:block shrink-0 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex px-4 max-w-5xl mx-auto">
          {TAB_ITEMS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 py-3 px-4 text-sm font-medium relative transition-colors",
                  isActive ? "text-emerald-600" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="proTabIndicatorDesktop"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-700 border-0 font-bold">{tab.count}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-y-contain pb-[84px] md:pb-0">
        <AnimatePresence mode="wait">
          {activeTab === 'leads' && (
            <motion.div
              key="leads"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-h-full"
            >
{/* ── Summary Cards ─────────────────────────────────────────── */}
              {!loading && (
                <div className="px-3 pt-3 pb-1 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-3 flex flex-col items-center shadow-sm">
                    <span className="text-[22px] font-extrabold text-white leading-none">{leadStats.total}</span>
                    <span className="text-[10px] text-emerald-100 font-medium mt-0.5">Total Leads</span>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 p-3 flex flex-col items-center shadow-sm">
                    <span className="text-[22px] font-extrabold text-white leading-none">{leadStats.visited}</span>
                    <span className="text-[10px] text-sky-100 font-medium mt-0.5">Visited</span>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-3 flex flex-col items-center shadow-sm">
                    <span className="text-[22px] font-extrabold text-white leading-none">{leadStats.remaining}</span>
                    <span className="text-[10px] text-amber-100 font-medium mt-0.5">Remaining</span>
                  </div>
                </div>
              )}

              {/* ── Today's Follow-ups (home page) ──────────────────── */}
              {!loading && todayReminders.length > 0 && (
                <div className="px-3 pt-3 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-800">Today's Follow-ups</span>
                      <Badge className="h-4 min-w-4 px-1.5 text-[9px] bg-amber-500 text-white border-0 font-bold animate-pulse">
                        {todayReminders.length}
                      </Badge>
                    </div>
                    <button
                      onClick={() => setActiveTab('reminders')}
                      className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      View all →
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 snap-x">
                    {todayReminders.slice(0, 8).map((reminder: any) => {
                      const isOverdueReminder = isOverdue(reminder.dueAt);
                      return (
                        <button
                          key={reminder.id}
                          onClick={() => setSelectedLeadId(reminder.leadId)}
                          className={cn(
                            "shrink-0 snap-start w-[210px] text-left rounded-xl border-2 bg-white p-2.5 shadow-md hover:shadow-lg transition-all relative overflow-hidden",
                            isOverdueReminder
                              ? "border-red-300 ring-2 ring-red-200/50"
                              : "border-amber-400 ring-2 ring-amber-200/60"
                          )}
                        >
                          {/* Pulsing accent strip */}
                          <div className={cn(
                            "absolute top-0 left-0 right-0 h-0.5 animate-pulse",
                            isOverdueReminder ? "bg-red-500" : "bg-amber-500"
                          )} />
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className={cn(
                              "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                              isOverdueReminder ? "bg-red-100" : "bg-amber-100"
                            )}>
                              <Bell className={cn("h-3 w-3", isOverdueReminder ? "text-red-500" : "text-amber-600")} />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-800 truncate flex-1">{reminder.leadDisplayName}</span>
                            {isOverdueReminder ? (
                              <Badge className="text-[8px] bg-red-500 text-white border-0 font-bold px-1 py-0">OVERDUE</Badge>
                            ) : (
                              <Badge className="text-[8px] bg-amber-500 text-white border-0 font-bold px-1 py-0">TODAY</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className={cn("h-2.5 w-2.5", isOverdueReminder ? "text-red-400" : "text-amber-500")} />
                            <span className={cn("text-[9px] font-medium", isOverdueReminder ? "text-red-600" : "text-amber-700")}>
                              {formatDate(reminder.dueAt)}
                            </span>
                          </div>
                          {reminder.note && (
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{reminder.note}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

{/* ── Search & Filter Bar ────────────────────────────────────────── */}
                <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-100 flex flex-col gap-2 px-3 py-2.5 z-10">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search by name, phone, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm focus-visible:ring-emerald-500 focus-visible:border-emerald-400 rounded-xl"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {assignedAreas.length > 0 && (
                      <select
                        className="h-9 w-28 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl focus:ring-emerald-500 focus:border-emerald-400 px-2 outline-none"
                        value={areaFilter}
                        onChange={(e) => setAreaFilter(e.target.value)}
                      >
                        <option value="">All Areas</option>
                        {assignedAreas.map(area => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>
                    )}
                    {/* Add Lead button */}
                    <Button
                      size="sm"
                      className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                      onClick={() => setShowAddLeadForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Referral filter chip + result count */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReferralFilter(f => !f)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                          referralFilter
                            ? "bg-purple-100 text-purple-700 border-purple-300"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        )}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        Referral {leadStats.referralCount > 0 && `(${leadStats.referralCount})`}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {(searchQuery || areaFilter || referralFilter) ? (
                        <>{filteredLeads.length} of {leads.length} leads</>
                      ) : (
                        <>{leads.length} lead{leads.length !== 1 ? 's' : ''}</>
                      )}
                    </span>
                  </div>
                </div>

              {/* ── Status Funnel Bar ─────────────────────────────────── */}
              {!loading && leads.length > 0 && statusFunnel.length > 0 && (
                <div className="px-3 py-2.5 bg-white border-b border-slate-50">
                  {/* Segmented bar */}
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                    {statusFunnel.map(segment => (
                      <motion.div
                        key={segment.key}
                        initial={{ width: 0 }}
                        animate={{ width: `${(segment.count / leads.length) * 100}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={cn("h-full", segment.color)}
                        style={{ minWidth: segment.count > 0 ? '4px' : '0' }}
                      />
                    ))}
                  </div>
                  {/* Labels */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {statusFunnel.map(segment => (
                      <div key={segment.key} className="flex items-center gap-1">
                        <div className={cn("h-2 w-2 rounded-full", segment.color)} />
                        <span className="text-[10px] text-slate-500 font-medium">
                          {segment.count} {segment.key === 'UNKNOWN' ? 'Other' : segment.key.charAt(0) + segment.key.slice(1).toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Leads List ────────────────────────────────────────── */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-500 mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Loading leads...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                /* ── Better Empty State ──────────────────────────────── */
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <motion.div
                    {...floatAnimation}
                    className="mb-4"
                  >
                    <div className="h-20 w-20 rounded-3xl bg-emerald-50 flex items-center justify-center">
                      <UserCheck className="h-10 w-10 text-emerald-300" />
                    </div>
                  </motion.div>
                  <p className="text-sm font-semibold text-slate-500">No leads assigned</p>
                  <p className="text-xs mt-1 text-slate-400 max-w-[200px] text-center">
                    Leads assigned to your areas will appear here
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="px-3 py-2 space-y-2"
                >
                  {filteredLeads.map(lead => {
                    const overdue = isOverdue(lead.nextFollowupAt);
                    const isJoined = lead.lastStatusCode?.toUpperCase().includes('JOINED');
                    
                    return (
                      <motion.div
                        key={lead.id}
                        variants={item}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "rounded-xl shadow-sm border-l-4 overflow-hidden cursor-pointer transition-all",
                          getBorderColor(lead.lastStatusCode),
                          isJoined ? "bg-emerald-50/50 border border-emerald-100" : "bg-white hover:bg-slate-50 active:bg-slate-50"
                        )}
                        onClick={() => setSelectedLeadId(lead.leadId)}
                      >
                        <div className="px-3.5 py-3 flex flex-col h-full">
                          <div className="flex items-start justify-between gap-2">
                            <div className={cn("flex-1 min-w-0 transition-opacity", isJoined && "opacity-90")}>
                              <div className="flex items-center gap-2">
                                <p className={cn("text-sm font-semibold truncate", isJoined ? "text-emerald-900" : "text-slate-900")}>
                                  {lead.studentName}
                                </p>
                                {isJoined && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                              </div>
                              <p className="text-xs text-slate-500 truncate">{lead.parentName} &middot; {lead.uniqueLeadId}</p>
                              {/* Class/group info if available */}
                              {(lead as any).intermediateGroup && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <BookOpen className="h-2.5 w-2.5 text-teal-500" />
                                  <span className="text-[10px] text-teal-600 font-medium">{(lead as any).intermediateGroup}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <MapPin className="h-3 w-3 text-emerald-500" />
                                  {lead.divisionName || 'No area'}
                                </span>
                                {lead.parentPhone && (
                                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <Phone className="h-3 w-3" />
                                    {formatPhone(lead.parentPhone)}
                                  </span>
                                )}
                              </div>
                              
                              {isJoined && lead.joinedCollegeName && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-100/50 border border-emerald-200/50 rounded-md">
                                  <GraduationCap className="h-3 w-3 text-emerald-600" />
                                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                                    {lead.joinedCollegeName}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end gap-1.5 shrink-0 mt-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {(lead as any).isReferral && (
                                  <Badge className="text-[9px] bg-purple-100 text-purple-700 border-0 font-bold px-1.5 py-0">
                                    REFERRAL
                                  </Badge>
                                )}
                                {lead.lastApproachType && (
                                  <Badge className={cn(
                                    "text-[9px] border font-medium px-1.5 py-0",
                                    APPROACH_COLORS[lead.lastApproachType as ApproachType] || 'border-slate-200 text-slate-600'
                                  )}>
                                    {lead.lastApproachType}
                                  </Badge>
                                )}
                                {lead.lastStatusCode && (
                                  <Badge className={cn("text-[10px] border font-medium", getBadgeColor(lead.lastStatusCode))}>
                                    {lead.lastStatusLabel || lead.lastStatusCode}
                                  </Badge>
                                )}
                              </div>
                              
                              {lead.nextFollowupAt && !isJoined && (
                                <span className={cn(
                                  "flex items-center gap-0.5 text-[10px] font-medium mt-1",
                                  overdue ? "text-red-500 bg-red-50 px-1 py-0.5 rounded" : "text-emerald-600"
                                )}>
                                  {overdue ? (
                                    <AlertCircle className="h-2.5 w-2.5" />
                                  ) : (
                                    <Calendar className="h-2.5 w-2.5" />
                                  )}
                                  {formatShortDate(lead.nextFollowupAt)}
                                  {overdue && <span className="ml-0.5">(Overdue)</span>}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'updates' && (
            <motion.div
              key="updates"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-h-full"
            >
              {/* Updates header */}
              <div className="px-3 pt-3 pb-2 bg-white border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-800">Recent Updates</span>
                  <Badge className="h-4 min-w-4 px-1.5 text-[9px] bg-emerald-50 text-emerald-700 border-0 font-bold">
                    {recentUpdates.length}
                  </Badge>
                </div>
              </div>

              {recentUpdates.length === 0 ? (
                /* ── Better Empty State ──────────────────────────────── */
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <motion.div
                    {...floatAnimation}
                    className="mb-4"
                  >
                    <div className="h-20 w-20 rounded-3xl bg-sky-50 flex items-center justify-center">
                      <Activity className="h-10 w-10 text-sky-300" />
                    </div>
                  </motion.div>
                  <p className="text-sm font-semibold text-slate-500">No recent updates</p>
                  <p className="text-xs mt-1 text-slate-400">Your status updates will appear here</p>
                </div>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="px-3 py-2 space-y-2">
                  {recentUpdates.map((update: any) => (
                    <motion.div key={update.id} variants={item}>
                      <div className={cn(
                        "rounded-xl bg-white p-3 shadow-sm border border-slate-100"
                      )}>
                        <div className="flex items-start gap-2.5">
                          {/* Approach type icon in colored circle */}
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            APPROACH_CIRCLE_COLORS[update.approachType as ApproachType] || 'bg-slate-100 text-slate-500'
                          )}>
                            {APPROACH_ICONS[update.approachType as ApproachType] || <Activity className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge className={cn(
                                "text-[10px] border font-medium",
                                APPROACH_COLORS[update.approachType as ApproachType] || 'border-slate-200 text-slate-600'
                              )}>
                                {update.approachType}
                              </Badge>
                              <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-medium">
                                {update.statusLabel || update.statusCode}
                              </Badge>
                            </div>
                            {update.comments && (
                              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{update.comments}</p>
                            )}
                            {update.gpsCaptured && update.gpsLocation && (
                              <p className="text-[10px] text-sky-500 mt-1 font-mono">
                                📍 {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">{formatDate(update.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'reminders' && (
            <motion.div
              key="reminders"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-h-full"
            >
              {/* Reminders header */}
              <div className="px-3 pt-3 pb-2 bg-white border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-800">My Reminders</span>
                  {reminders.length > 0 && (
                    <Badge className="h-4 min-w-4 px-1.5 text-[9px] bg-amber-50 text-amber-700 border-0 font-bold">
                      {reminders.length}
                    </Badge>
                  )}
                </div>
              </div>

              {reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <motion.div {...floatAnimation} className="mb-4">
                    <div className="h-20 w-20 rounded-3xl bg-amber-50 flex items-center justify-center">
                      <Bell className="h-10 w-10 text-amber-200" />
                    </div>
                  </motion.div>
                  <p className="text-sm font-semibold text-slate-500">No pending reminders</p>
                  <p className="text-xs mt-1 text-slate-400">Set a reminder from any lead's detail view</p>
                </div>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="px-3 py-2 space-y-2">
                  {reminders.map((reminder) => {
                    const isOverdueReminder = isOverdue(reminder.dueAt);
                    const isBusy = reminderActionLoading === reminder.id;
                    const showSnooze = snoozeMenuId === reminder.id;
                    // Is this reminder due today?
                    let isTodayReminder = false;
                    try {
                      const d = (reminder as any).dueAt?.toDate?.() || (reminder as any).dueAt;
                      if (d instanceof Date) {
                        const now = new Date();
                        isTodayReminder =
                          d.getFullYear() === now.getFullYear() &&
                          d.getMonth() === now.getMonth() &&
                          d.getDate() === now.getDate();
                      }
                    } catch { /* ignore */ }

                    const doAction = async (subAction: 'complete' | 'cancel' | 'snooze', snoozeDuration?: string) => {
                      setReminderActionLoading(reminder.id);
                      setSnoozeMenuId(null);
                      try {
                        await manageReminderViaCloudFunction({ subAction, reminderId: reminder.id, snoozeDuration });
                      } catch (err) {
                        console.error('Reminder action failed:', err);
                      } finally {
                        setReminderActionLoading(null);
                      }
                    };

                    return (
                      <motion.div key={reminder.id} variants={item} layout>
                        <div
                          className={cn(
                            "rounded-xl bg-white shadow-sm border-2 transition-all",
                            isOverdueReminder
                              ? "border-red-300 bg-red-50/40 shadow-red-100"
                              : isTodayReminder
                                ? "border-amber-400 bg-amber-50/40 shadow-amber-100 ring-2 ring-amber-200/60"
                                : "border-slate-100"
                          )}
                        >
                          {/* Main row — tap to open lead */}
                          <div
                            className="flex items-start gap-2.5 p-3 cursor-pointer"
                            onClick={() => { setSnoozeMenuId(null); setSelectedLeadId(reminder.leadId); }}
                          >
                            <div className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                              isOverdueReminder ? "bg-red-100" : "bg-amber-50"
                            )}>
                              <Bell className={cn("h-4 w-4", isOverdueReminder ? "text-red-500" : "text-amber-500")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{reminder.leadDisplayName}</p>
                              <p className="text-[10px] text-slate-400">Lead #{reminder.uniqueLeadId}</p>
                              {reminder.note && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{reminder.note}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <Clock className={cn("h-3 w-3", isOverdueReminder ? "text-red-400" : "text-amber-400")} />
                                <span className={cn("text-[10px] font-medium", isOverdueReminder ? "text-red-600" : "text-amber-600")}>
                                  {formatDate(reminder.dueAt)}
                                </span>
                                {isOverdueReminder && (
                                  <Badge className="text-[9px] bg-red-100 text-red-700 border-0 font-bold px-1.5 py-0">OVERDUE</Badge>
                                )}
                                {!isOverdueReminder && isTodayReminder && (
                                  <Badge className="text-[9px] bg-amber-500 text-white border-0 font-bold px-1.5 py-0 animate-pulse">TODAY</Badge>
                                )}
                                <Badge variant="outline" className="text-[9px] px-1.5 border-amber-200 text-amber-700">
                                  {reminder.status}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          {/* Action row */}
                          <div className="flex items-center border-t border-slate-100 divide-x divide-slate-100">
                            {/* Done */}
                            <button
                              disabled={isBusy}
                              onClick={() => doAction('complete')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors disabled:opacity-40"
                            >
                              {isBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              Done
                            </button>
                            {/* Snooze */}
                            <button
                              disabled={isBusy}
                              onClick={(e) => { e.stopPropagation(); setSnoozeMenuId(showSnooze ? null : reminder.id); }}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                                showSnooze
                                  ? "bg-amber-50 text-amber-700"
                                  : "text-amber-600 hover:bg-amber-50 active:bg-amber-100"
                              )}
                            >
                              <AlarmClock className="h-3.5 w-3.5" />
                              Snooze
                            </button>
                            {/* Dismiss */}
                            <button
                              disabled={isBusy}
                              onClick={() => doAction('cancel')}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-slate-400 hover:bg-slate-50 hover:text-red-500 active:bg-red-50 transition-colors disabled:opacity-40"
                            >
                              <X className="h-3.5 w-3.5" />
                              Dismiss
                            </button>
                          </div>

                          {/* Snooze options — inline dropdown */}
                          <AnimatePresence>
                            {showSnooze && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden border-t border-amber-100 bg-amber-50/60"
                              >
                                <div className="flex items-center divide-x divide-amber-100">
                                  {[
                                    { label: '1 hour', value: '1h' },
                                    { label: 'Tomorrow', value: 'tomorrow' },
                                    { label: '3 days', value: '3d' },
                                  ].map(opt => (
                                    <button
                                      key={opt.value}
                                      onClick={() => doAction('snooze', opt.value)}
                                      className="flex-1 py-2.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 active:bg-amber-200 transition-colors"
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'daysheet' && (
            <motion.div
              key="daysheet"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-h-full"
            >
              {/* Day Sheet Header */}
              <div className="px-3 pt-3 pb-2 bg-white border-b border-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-800">Day Sheet</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date"
                      value={daySheetDate}
                      onChange={(e) => setDaySheetDate(e.target.value)}
                      className="h-7 text-xs w-[130px] bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-lg"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={downloadDaySheet}
                      disabled={filteredDaySheetUpdates.length === 0}
                      title="Download Day Sheet (Excel)"
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1" />Excel
                    </Button>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="px-3 py-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <motion.div whileHover={{ y: -1 }} className="rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 p-2.5 shadow-sm">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Phone className="h-3 w-3 text-sky-200" />
                      <span className="text-[9px] text-sky-100 font-medium">Calls</span>
                    </div>
                    <p className="text-lg font-bold text-white">{daySheetSummary.calls}</p>
                  </motion.div>
                  <motion.div whileHover={{ y: -1 }} className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 shadow-sm">
                    <div className="flex items-center gap-1 mb-0.5">
                      <DoorOpen className="h-3 w-3 text-emerald-200" />
                      <span className="text-[9px] text-emerald-100 font-medium">Visits</span>
                    </div>
                    <p className="text-lg font-bold text-white">{daySheetSummary.visits}</p>
                  </motion.div>
                  <motion.div whileHover={{ y: -1 }} className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 p-2.5 shadow-sm">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Globe className="h-3 w-3 text-teal-200" />
                      <span className="text-[9px] text-teal-100 font-medium">Online</span>
                    </div>
                    <p className="text-lg font-bold text-white">{daySheetSummary.online}</p>
                  </motion.div>
                  <motion.div whileHover={{ y: -1 }} className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-2.5 shadow-sm">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Footprints className="h-3 w-3 text-amber-200" />
                      <span className="text-[9px] text-amber-100 font-medium">Walk-in</span>
                    </div>
                    <p className="text-lg font-bold text-white">{daySheetSummary.walkIn}</p>
                  </motion.div>
                  <motion.div whileHover={{ y: -1 }} className="rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 p-2.5 shadow-sm">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Activity className="h-3 w-3 text-slate-200" />
                      <span className="text-[9px] text-slate-100 font-medium">Total</span>
                    </div>
                    <p className="text-lg font-bold text-white">{daySheetSummary.total}</p>
                  </motion.div>
                  <motion.div whileHover={{ y: -1 }} className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 p-2.5 shadow-sm">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Users className="h-3 w-3 text-emerald-200" />
                      <span className="text-[9px] text-emerald-100 font-medium">Leads</span>
                    </div>
                    <p className="text-lg font-bold text-white">{daySheetSummary.leadsUpdated}</p>
                  </motion.div>
                </div>
              </div>

              {/* Approach Type Filter */}
              <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                  {[
                    { key: 'ALL', label: 'All' },
                    { key: 'PHONE', label: 'Calls' },
                    { key: 'DOORSTEP', label: 'Visits' },
                    { key: 'ONLINE', label: 'Online' },
                    { key: 'WALK_IN', label: 'Walk-in' },
                  ].map(ft => (
                    <button
                      key={ft.key}
                      onClick={() => setDaySheetApproachFilter(ft.key)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors shrink-0",
                        daySheetApproachFilter === ft.key
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300"
                      )}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Updates List */}
              {daySheetLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-500 mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Loading day sheet...</p>
                </div>
              ) : filteredDaySheetUpdates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <motion.div {...floatAnimation} className="mb-4">
                    <div className="h-20 w-20 rounded-3xl bg-emerald-50 flex items-center justify-center">
                      <ClipboardList className="h-10 w-10 text-emerald-300" />
                    </div>
                  </motion.div>
                  <p className="text-sm font-semibold text-slate-500">No updates on this day</p>
                  <p className="text-xs mt-1 text-slate-400">Your status updates for the selected date will appear here</p>
                </div>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show" className="px-3 py-2 space-y-2">
                  {filteredDaySheetUpdates.map((update: any) => (
                    <motion.div key={update.id} variants={item}>
                      <div className="rounded-xl bg-white p-3 shadow-sm border border-slate-100">
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            APPROACH_CIRCLE_COLORS[update.approachType as ApproachType] || 'bg-slate-100 text-slate-500'
                          )}>
                            {APPROACH_ICONS[update.approachType as ApproachType] || <Activity className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Lead name */}
                            <p className="text-xs font-semibold text-slate-800 truncate">
                              {leadNameMap[update.leadId] || `Lead: ${update.leadId?.slice(0, 8)}...`}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <Badge className={cn(
                                "text-[10px] border font-medium",
                                APPROACH_COLORS[update.approachType as ApproachType] || 'border-slate-200 text-slate-600'
                              )}>
                                {update.approachType}
                              </Badge>
                              <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-medium">
                                {update.statusLabel || update.statusCode}
                              </Badge>
                            </div>
                            {update.comments && (
                              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{update.comments}</p>
                            )}
                            {update.gpsCaptured && update.gpsLocation && (
                              <p className="text-[10px] text-sky-500 mt-1 font-mono">
                                📍 {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">{formatDate(update.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-h-full p-4 space-y-3"
            >
              {/* Profile Card */}
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-xl font-bold text-white">{user?.displayName?.charAt(0)?.toUpperCase() || 'P'}</span>
                      </div>
                      <div>
                        <p className="text-base font-bold text-white">{user?.displayName}</p>
                        <p className="text-xs text-emerald-100/80">{user?.role}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/80 hover:text-white hover:bg-white/20 h-8 px-3 text-xs"
                      onClick={() => {
                        setEditName(user?.displayName || '');
                        setEditPhone(user?.phone || '');
                        setProfileError('');
                        setEditProfileOpen(true);
                      }}
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  {[
                    { icon: Mail, label: 'Email', value: user?.email },
                    { icon: User, label: 'Username', value: user?.username ? `@${user.username}` : null },
                    { icon: Phone, label: 'Phone', value: user?.phone ? formatPhone(user.phone) : null },
                    { icon: Building2, label: 'College', value: user?.tenantName },
                    { icon: MapPin, label: 'Area', value: user?.assignedDivisionIds?.length ? `${user.assignedDivisionIds.length} area(s)` : 'Not assigned' },
                  ].map((field, i) => field.value ? (
                    <div key={field.label} className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      i > 0 && "border-t border-slate-50"
                    )}>
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                        <field.icon className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{field.label}</p>
                        <p className="text-sm font-medium text-slate-800">{field.value}</p>
                      </div>
                    </div>
                  ) : null)}
                </CardContent>
              </Card>

              {/* ── Stats Summary Cards ──────────────────────────────── */}
              <div className="grid grid-cols-3 gap-2">
                <motion.div
                  whileHover={{ y: -2 }}
                  className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3.5 w-3.5 text-emerald-200" />
                    <span className="text-[10px] text-emerald-100 font-medium">Total Leads</span>
                  </div>
                  <p className="text-xl font-bold text-white">{profileStats.totalLeads}</p>
                </motion.div>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 p-3 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="h-3.5 w-3.5 text-sky-200" />
                    <span className="text-[10px] text-sky-100 font-medium">Updates Today</span>
                  </div>
                  <p className="text-xl font-bold text-white">{profileStats.updatesToday}</p>
                </motion.div>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-3 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bell className="h-3.5 w-3.5 text-amber-200" />
                    <span className="text-[10px] text-amber-100 font-medium">Reminders</span>
                  </div>
                  <p className="text-xl font-bold text-white">{profileStats.pendingReminders}</p>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Lead Detail Sheet ────────────────────────────────────────── */}
      {/* Bottom Nav Bar */}
      <nav className="md:hidden shrink-0 fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200/80">
        <div className="flex items-center justify-around h-[68px] px-2 pb-[env(safe-area-inset-bottom)]">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex flex-col items-center justify-center w-full h-full"
              >
                {isActive && (
                  <motion.div
                    layoutId="proActiveTabBg"
                    className="absolute inset-x-2 top-1 bottom-1 rounded-2xl bg-emerald-50"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative flex flex-col items-center gap-1 z-10">
                  <div className={cn(
                    "p-1.5 rounded-xl transition-colors duration-200",
                    isActive ? "text-emerald-600 bg-emerald-100/50" : "text-slate-400"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold transition-colors duration-200",
                    isActive ? "text-emerald-700" : "text-slate-400"
                  )}>
                    {tab.label}
                  </span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="absolute -top-1 -right-2 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold shadow-sm">
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {selectedLeadId && (
        <LeadDetailView
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
