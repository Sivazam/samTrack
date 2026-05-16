'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, collectionGroup, query, where, orderBy, getDocs, Timestamp,
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Loader2, BarChart3, Users, Clock,
  Download, Filter, Phone, DoorOpen, Globe, Footprints,
  Activity, TrendingUp, UserCheck, MapPin, Calendar,
  ClipboardList, ChevronDown, ChevronUp, Eye, Target,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DivisionInfo {
  id: string;
  name: string;
  code: string;
}

interface TeamInfo {
  id: string;
  name: string;
  memberUids: string[];
  divisionIds: string[];
}

interface PROInfo {
  uid: string;
  displayName: string;
  teamId?: string;
  assignedDivisionIds?: string[];
}

type ViewMode = 'summary' | 'detail';
type ReportTab = 'daily' | 'performance' | 'area';

// ─── Approach Type Config ─────────────────────────────────────────────────────

const APPROACH_ICONS: Record<string, React.ReactNode> = {
  PHONE: <Phone className="h-3 w-3" />,
  DOORSTEP: <DoorOpen className="h-3 w-3" />,
  WALK_IN: <Footprints className="h-3 w-3" />,
  ONLINE: <Globe className="h-3 w-3" />,
};

const APPROACH_COLORS: Record<string, string> = {
  PHONE: 'bg-sky-50 text-sky-700 border-sky-200',
  DOORSTEP: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WALK_IN: 'bg-teal-50 text-teal-700 border-teal-200',
  ONLINE: 'bg-blue-50 text-blue-700 border-blue-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReportDate(value: any): string {
  try {
    if (!value) return '—';
    if (value?.toDate) return format(value.toDate(), 'dd MMM, hh:mm a');
    if (value?.seconds !== undefined) return format(new Date(value.seconds * 1000), 'dd MMM, hh:mm a');
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : format(d, 'dd MMM, hh:mm a');
  } catch {
    return String(value);
  }
}

function formatShortTime(value: any): string {
  try {
    if (!value) return '—';
    if (value?.toDate) return format(value.toDate(), 'hh:mm a');
    if (value?.seconds !== undefined) return format(new Date(value.seconds * 1000), 'hh:mm a');
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : format(d, 'hh:mm a');
  } catch {
    return String(value);
  }
}

// ─── Animation Variants ──────────────────────────────────────────────────────

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const itemVariant = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportsPanel() {
  const { user } = useAuth();

  // Date range — defaults to today
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Filters
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [proFilter, setProFilter] = useState<string>('ALL');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [reportTab, setReportTab] = useState<ReportTab>('daily');

  // Data
  const [divisions, setDivisions] = useState<DivisionInfo[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [pros, setPros] = useState<PROInfo[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [expandedPro, setExpandedPro] = useState<string | null>(null);

  // ─── Load divisions, teams, PROs on mount ──────────────────────────────────

  useEffect(() => {
    if (!user?.tenantId) return;

    const loadFilters = async () => {
      try {
        // Load divisions
        const divSnapshot = await getDocs(query(
          collection(db, 'divisions'),
          where('tenantId', '==', user.tenantId)
        ));
        setDivisions(divSnapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name || '',
          code: d.data().code || '',
        })));

        // Load teams
        const teamSnapshot = await getDocs(query(
          collection(db, 'teams'),
          where('tenantId', '==', user.tenantId)
        ));
        setTeams(teamSnapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name || '',
          memberUids: d.data().memberUids || [],
          divisionIds: d.data().divisionIds || [],
        })));

        // Load PRO users
        const proSnapshot = await getDocs(query(
          collection(db, 'users'),
          where('tenantId', '==', user.tenantId),
          where('role', '==', 'PRO')
        ));
        setPros(proSnapshot.docs.map(d => ({
          uid: d.id,
          displayName: d.data().displayName || '',
          teamId: d.data().teamId || undefined,
          assignedDivisionIds: d.data().assignedDivisionIds || [],
        })));
      } catch (error) {
        console.error('Error loading filters:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadFilters();
  }, [user?.tenantId]);

  // ─── Filtered PROs based on team/area filters ──────────────────────────────

  const filteredPros = useMemo(() => {
    let result = pros;

    if (teamFilter !== 'ALL') {
      const team = teams.find(t => t.id === teamFilter);
      if (team) {
        result = result.filter(p => team.memberUids.includes(p.uid));
      }
    }

    if (areaFilter !== 'ALL') {
      result = result.filter(p =>
        p.assignedDivisionIds?.includes(areaFilter)
      );
    }

    return result;
  }, [pros, teamFilter, areaFilter, teams]);

  // ─── Fetch updates ────────────────────────────────────────────────────────

  const fetchUpdates = useCallback(async () => {
    if (!user?.tenantId || !startDate || !endDate) return;

    setLoading(true);
    try {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const startTimestamp = Timestamp.fromDate(new Date(sy, sm - 1, sd, 0, 0, 0, 0));
      const endTimestamp = Timestamp.fromDate(new Date(ey, em - 1, ed, 23, 59, 59, 999));

      const q = query(
        collectionGroup(db, 'statusUpdates'),
        where('tenantId', '==', user.tenantId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Client-side filters for PRO, team, area
      if (proFilter !== 'ALL') {
        results = results.filter((u: any) => u.loggedByUid === proFilter);
      }

      if (teamFilter !== 'ALL') {
        const team = teams.find(t => t.id === teamFilter);
        if (team) {
          results = results.filter((u: any) =>
            team.memberUids.includes(u.loggedByUid)
          );
        }
      }

      if (areaFilter !== 'ALL') {
        // Filter by PROs assigned to this area
        const areaPros = pros.filter(p =>
          p.assignedDivisionIds?.includes(areaFilter)
        );
        const areaProUids = new Set(areaPros.map(p => p.uid));
        results = results.filter((u: any) => areaProUids.has(u.loggedByUid));
      }

      setUpdates(results);
    } catch (error) {
      console.error('Error fetching updates:', error);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, startDate, endDate, proFilter, teamFilter, areaFilter, teams, pros]);

  // Auto-fetch when filters change
  useEffect(() => {
    if (!initialLoading) {
      fetchUpdates();
    }
  }, [fetchUpdates, initialLoading]);

  // ─── Summary by PRO ───────────────────────────────────────────────────────

  const proSummary = useMemo(() => {
    const summaryMap: Record<string, {
      uid: string;
      name: string;
      calls: number;
      visits: number;
      online: number;
      walkIn: number;
      total: number;
      leadsUpdated: Set<string>;
      firstActivity: any;
      lastActivity: any;
    }> = {};

    // Initialize all PROs (even those with 0 updates)
    filteredPros.forEach(pro => {
      summaryMap[pro.uid] = {
        uid: pro.uid,
        name: pro.displayName,
        calls: 0,
        visits: 0,
        online: 0,
        walkIn: 0,
        total: 0,
        leadsUpdated: new Set(),
        firstActivity: null,
        lastActivity: null,
      };
    });

    updates.forEach((update: any) => {
      const uid = update.loggedByUid;
      if (!summaryMap[uid]) {
        summaryMap[uid] = {
          uid,
          name: update.loggedByName || 'Unknown',
          calls: 0,
          visits: 0,
          online: 0,
          walkIn: 0,
          total: 0,
          leadsUpdated: new Set(),
          firstActivity: null,
          lastActivity: null,
        };
      }
      const s = summaryMap[uid];
      s.total++;
      if (update.approachType === 'PHONE') s.calls++;
      if (update.approachType === 'DOORSTEP') s.visits++;
      if (update.approachType === 'ONLINE') s.online++;
      if (update.approachType === 'WALK_IN') s.walkIn++;
      if (update.leadId) s.leadsUpdated.add(update.leadId);

      // Track first/last activity times
      const ts = update.createdAt;
      if (!s.firstActivity || (ts && ts < s.firstActivity)) s.firstActivity = ts;
      if (!s.lastActivity || (ts && ts > s.lastActivity)) s.lastActivity = ts;
    });

    return Object.values(summaryMap)
      .map(s => {
        const proInfo = filteredPros.find(p => p.uid === s.uid) || pros.find(p => p.uid === s.uid);
        return {
          ...s,
          leadsCount: s.leadsUpdated.size,
          assignedDivisionIds: proInfo?.assignedDivisionIds || [],
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [updates, filteredPros, pros]);

  // ─── Area Summary ──────────────────────────────────────────────────────────

  const areaSummary = useMemo(() => {
    const areaMap: Record<string, {
      divisionId: string;
      divisionName: string;
      divisionCode: string;
      calls: number;
      visits: number;
      online: number;
      walkIn: number;
      total: number;
      leadsTouched: Set<string>;
      proCount: Set<string>;
    }> = {};

    // Initialize from divisions
    divisions.forEach(d => {
      areaMap[d.id] = {
        divisionId: d.id,
        divisionName: d.name,
        divisionCode: d.code,
        calls: 0,
        visits: 0,
        online: 0,
        walkIn: 0,
        total: 0,
        leadsTouched: new Set(),
        proCount: new Set(),
      };
    });

    // Process updates - match by PRO's assigned areas
    updates.forEach((update: any) => {
      const proInfo = pros.find(p => p.uid === update.loggedByUid);
      if (proInfo?.assignedDivisionIds) {
        proInfo.assignedDivisionIds.forEach(divId => {
          if (!areaMap[divId]) {
            const divInfo = divisions.find(d => d.id === divId);
            areaMap[divId] = {
              divisionId: divId,
              divisionName: divInfo?.name || 'Unknown',
              divisionCode: divInfo?.code || '?',
              calls: 0,
              visits: 0,
              online: 0,
              walkIn: 0,
              total: 0,
              leadsTouched: new Set(),
              proCount: new Set(),
            };
          }
          const a = areaMap[divId];
          a.total++;
          if (update.approachType === 'PHONE') a.calls++;
          if (update.approachType === 'DOORSTEP') a.visits++;
          if (update.approachType === 'ONLINE') a.online++;
          if (update.approachType === 'WALK_IN') a.walkIn++;
          if (update.leadId) a.leadsTouched.add(update.leadId);
          a.proCount.add(update.loggedByUid);
        });
      }
    });

    return Object.values(areaMap)
      .map(a => ({ ...a, leadsCount: a.leadsTouched.size, activePros: a.proCount.size }))
      .filter(a => a.total > 0 || divisions.some(d => d.id === a.divisionId))
      .sort((a, b) => b.total - a.total);
  }, [updates, divisions, pros]);

  // ─── Totals ────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    return proSummary.reduce(
      (acc, s) => ({
        calls: acc.calls + s.calls,
        visits: acc.visits + s.visits,
        online: acc.online + s.online,
        walkIn: acc.walkIn + s.walkIn,
        total: acc.total + s.total,
        leadsCount: acc.leadsCount + s.leadsCount,
      }),
      { calls: 0, visits: 0, online: 0, walkIn: 0, total: 0, leadsCount: 0 }
    );
  }, [proSummary]);

  // ─── Active PROs count ─────────────────────────────────────────────────────

  const activeProsCount = useMemo(() => {
    return proSummary.filter(p => p.total > 0).length;
  }, [proSummary]);

  // ─── PRO updates map (for expandable rows) ─────────────────────────────────

  const proUpdatesMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    updates.forEach((update: any) => {
      const uid = update.loggedByUid;
      if (!map[uid]) map[uid] = [];
      map[uid].push(update);
    });
    return map;
  }, [updates]);

  // ─── CSV Download ──────────────────────────────────────────────────────────

  const downloadCSV = useCallback(() => {
    const headers = ['PRO Name', 'Calls', 'Visits', 'Online', 'Walk-in', 'Total Updates', 'Leads Updated', 'First Activity', 'Last Activity'];
    const rows = proSummary.map(s => [
      s.name,
      s.calls,
      s.visits,
      s.online,
      s.walkIn,
      s.total,
      s.leadsCount,
      formatReportDate(s.firstActivity),
      formatReportDate(s.lastActivity),
    ]);

    // Add individual updates
    rows.push([]);
    rows.push(['--- Detailed Updates ---']);
    rows.push(['Timestamp', 'PRO Name', 'Approach Type', 'Status', 'Intermediate Group', 'Joined College', 'Comments', 'Accompanying Member', 'GPS Lat', 'GPS Lng']);
    updates.forEach((u: any) => {
      rows.push([
        formatReportDate(u.createdAt),
        u.loggedByName || '',
        u.approachType || '',
        u.statusLabel || u.statusCode || '',
        u.intermediateGroup || '',
        u.joinedCollegeName || '',
        (u.comments || '').replace(/,/g, ';'),
        u.accompanyingMemberName || '',
        u.gpsCaptured && u.gpsLocation ? u.gpsLocation.lat.toFixed(6) : '',
        u.gpsCaptured && u.gpsLocation ? u.gpsLocation.lng.toFixed(6) : '',
      ]);
    });

    // Add area summary
    rows.push([]);
    rows.push(['--- Area Summary ---']);
    rows.push(['Area Name', 'Area Code', 'Calls', 'Visits', 'Online', 'Walk-in', 'Total', 'Leads Touched', 'Active PROs']);
    areaSummary.forEach(a => {
      rows.push([
        a.divisionName,
        a.divisionCode,
        a.calls,
        a.visits,
        a.online,
        a.walkIn,
        a.total,
        a.leadsCount,
        a.activePros,
      ]);
    });

    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${startDate}_to_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [proSummary, updates, areaSummary, startDate, endDate]);

  const downloadExcel = useCallback(() => {
    // Sheet 1: PRO Summary
    const proHeaders = ['PRO Name', 'Calls', 'Visits', 'Online', 'Walk-in', 'Total Updates', 'Leads Updated', 'First Activity', 'Last Activity'];
    const proRows = proSummary.map(s => [
      s.name, s.calls, s.visits, s.online, s.walkIn, s.total, s.leadsCount,
      formatReportDate(s.firstActivity), formatReportDate(s.lastActivity),
    ]);
    const wsProSummary = XLSX.utils.aoa_to_sheet([proHeaders, ...proRows]);

    // Sheet 2: Detailed Updates
    const detailHeaders = ['Timestamp', 'PRO Name', 'Approach Type', 'Status', 'Intermediate Group', 'Joined College', 'Comments', 'Accompanying Member', 'GPS Lat', 'GPS Lng'];
    const detailRows = updates.map((u: any) => [
      formatReportDate(u.createdAt),
      u.loggedByName || '',
      u.approachType || '',
      u.statusLabel || u.statusCode || '',
      u.intermediateGroup || '',
      u.joinedCollegeName || '',
      u.comments || '',
      u.accompanyingMemberName || '',
      u.gpsCaptured && u.gpsLocation ? u.gpsLocation.lat.toFixed(6) : '',
      u.gpsCaptured && u.gpsLocation ? u.gpsLocation.lng.toFixed(6) : '',
    ]);
    const wsDetails = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);

    // Sheet 3: Area Summary
    const areaHeaders = ['Area Name', 'Area Code', 'Calls', 'Visits', 'Online', 'Walk-in', 'Total', 'Leads Touched', 'Active PROs'];
    const areaRows = areaSummary.map(a => [
      a.divisionName, a.divisionCode, a.calls, a.visits, a.online, a.walkIn, a.total, a.leadsCount, a.activePros,
    ]);
    const wsArea = XLSX.utils.aoa_to_sheet([areaHeaders, ...areaRows]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsProSummary, 'PRO Summary');
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Detailed Updates');
    XLSX.utils.book_append_sheet(wb, wsArea, 'Area Summary');
    XLSX.writeFile(wb, `report_${startDate}_to_${endDate}.xlsx`);
  }, [proSummary, updates, areaSummary, startDate, endDate]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
            <BarChart3 className="h-3.5 w-3.5 text-white" />
          </div>
          Reports
        </h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchUpdates}
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
            disabled={loading}
          >
            <Loader2 className={cn("h-3 w-3", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={downloadCSV}
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            disabled={updates.length === 0}
          >
            <Download className="h-3 w-3" />
            CSV
          </Button>
          <Button
            onClick={downloadExcel}
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50"
            disabled={updates.length === 0}
          >
            <Download className="h-3 w-3" />
            Excel
          </Button>
        </div>
      </div>

      {/* ── Filters Card ────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Date Range */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Date Range
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-slate-400">From</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-400">To</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Quick date buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { label: 'Today', start: 0, end: 0 },
              { label: 'Yesterday', start: -1, end: -1 },
              { label: 'Last 7d', start: -6, end: 0 },
              { label: 'Last 30d', start: -29, end: 0 },
              { label: 'This Month', start: -(new Date().getDate() - 1), end: 0 },
            ].map(qb => {
              const sd = new Date();
              sd.setDate(sd.getDate() + qb.start);
              const ed = new Date();
              ed.setDate(ed.getDate() + qb.end);
              const sv = format(sd, 'yyyy-MM-dd');
              const ev = format(ed, 'yyyy-MM-dd');
              const isActive = startDate === sv && endDate === ev;
              return (
                <button
                  key={qb.label}
                  onClick={() => { setStartDate(sv); setEndDate(ev); }}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-300"
                  )}
                >
                  {qb.label}
                </button>
              );
            })}
          </div>

          <Separator className="bg-slate-100" />

          {/* Filters */}
          <div className="space-y-2">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Filters
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-slate-400">Area</Label>
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Areas</SelectItem>
                    {divisions.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-400">Team</Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Teams</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-400">PRO</Label>
                <Select value={proFilter} onValueChange={setProFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All PROs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All PROs</SelectItem>
                    {filteredPros.map(p => (
                      <SelectItem key={p.uid} value={p.uid}>{p.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPIs ────────────────────────────────────────────────── */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: 'Total Calls', value: totals.calls, gradient: 'from-sky-500 to-sky-600', icon: Phone },
          { label: 'Total Visits', value: totals.visits, gradient: 'from-emerald-500 to-emerald-600', icon: DoorOpen },
          { label: 'Online', value: totals.online, gradient: 'from-teal-500 to-teal-600', icon: Globe },
          { label: 'Walk-in', value: totals.walkIn, gradient: 'from-amber-500 to-amber-600', icon: Footprints },
          { label: 'Total Updates', value: totals.total, gradient: 'from-slate-600 to-slate-700', icon: BarChart3 },
          { label: 'Leads Touched', value: totals.leadsCount, gradient: 'from-emerald-600 to-teal-500', icon: Target },
          { label: 'Active PROs', value: activeProsCount, gradient: 'from-teal-600 to-cyan-500', icon: UserCheck },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              variants={itemVariant}
              whileHover={{ y: -1 }}
              className={cn("rounded-xl bg-gradient-to-br p-2.5 shadow-sm", kpi.gradient)}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Icon className="h-3 w-3 text-white/60" />
                <span className="text-[9px] text-white/80 font-medium truncate">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold text-white">{kpi.value}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Report Tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        {[
          { key: 'daily' as ReportTab, label: 'Daily Activity', icon: Activity },
          { key: 'performance' as ReportTab, label: 'PRO Performance', icon: Users },
          { key: 'area' as ReportTab, label: 'Area Summary', icon: MapPin },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setReportTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all flex-1 justify-center",
                reportTab === tab.key
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Loading State ───────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <span className="text-xs text-slate-400 ml-2">Loading report...</span>
        </div>
      )}

      {/* ── Report Content ──────────────────────────────────────────────── */}
      {!loading && (
        <AnimatePresence mode="wait">
          {/* ──── DAILY ACTIVITY TAB ──── */}
          {reportTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-lg p-0.5 self-start">
                {[
                  { key: 'summary' as ViewMode, label: 'Summary', icon: BarChart3 },
                  { key: 'detail' as ViewMode, label: 'Detail', icon: FileText },
                ].map(vm => {
                  const Icon = vm.icon;
                  return (
                    <button
                      key={vm.key}
                      onClick={() => setViewMode(vm.key)}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        viewMode === vm.key
                          ? "bg-emerald-50 text-emerald-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {vm.label}
                    </button>
                  );
                })}
              </div>

              {viewMode === 'summary' ? (
                /* ── PRO-wise Summary Table ── */
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-600" />
                      PRO-wise Breakdown
                      <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-bold ml-auto">
                        {proSummary.length} PRO{proSummary.length !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3">
                    {proSummary.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <Users className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-400">No PRO data for the selected period</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">PRO Name</TableHead>
                              <TableHead className="text-[10px] text-center">Calls</TableHead>
                              <TableHead className="text-[10px] text-center">Visits</TableHead>
                              <TableHead className="text-[10px] text-center">Online</TableHead>
                              <TableHead className="text-[10px] text-center">Walk-in</TableHead>
                              <TableHead className="text-[10px] text-center">Total</TableHead>
                              <TableHead className="text-[10px] text-center">Leads</TableHead>
                              <TableHead className="text-[10px] text-center">Activity</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {proSummary.map(pro => {
                              const hasUpdates = pro.total > 0;
                              const proTeam = teams.find(t => t.memberUids.includes(pro.uid));
                              return (
                                <TableRow key={pro.uid} className={cn(hasUpdates && "cursor-pointer hover:bg-emerald-50/30")} onClick={() => hasUpdates && setExpandedPro(expandedPro === pro.uid ? null : pro.uid)}>
                                  <TableCell className="text-xs font-medium text-slate-800 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                        <span className="text-[9px] font-bold text-emerald-700">{pro.name.charAt(0)}</span>
                                      </div>
                                      <div className="min-w-0">
                                        <span className="truncate max-w-[100px] block">{pro.name}</span>
                                        {proTeam && (
                                          <span className="text-[9px] text-slate-400 truncate block">{proTeam.name}</span>
                                        )}
                                      </div>
                                      {hasUpdates && (
                                        expandedPro === pro.uid
                                          ? <ChevronUp className="h-3 w-3 text-slate-400 shrink-0 ml-auto" />
                                          : <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 ml-auto" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-center py-2">
                                    <Badge className="bg-sky-50 text-sky-700 border-0 text-[10px] font-bold">{pro.calls}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-center py-2">
                                    <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-bold">{pro.visits}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-center py-2">
                                    <Badge className="bg-teal-50 text-teal-700 border-0 text-[10px] font-bold">{pro.online}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-center py-2">
                                    <Badge className="bg-amber-50 text-amber-700 border-0 text-[10px] font-bold">{pro.walkIn}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-center py-2 font-bold text-slate-800">{pro.total}</TableCell>
                                  <TableCell className="text-xs text-center py-2">
                                    <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-bold">{pro.leadsCount}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-center py-2">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="text-[9px] text-slate-400">
                                        {pro.firstActivity ? formatShortTime(pro.firstActivity) : '—'}
                                      </span>
                                      <span className="text-[9px] text-slate-300">→</span>
                                      <span className="text-[9px] text-slate-400">
                                        {pro.lastActivity ? formatShortTime(pro.lastActivity) : '—'}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Totals row */}
                            <TableRow className="bg-slate-50">
                              <TableCell className="text-xs font-bold text-slate-700 py-2">Total</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-sky-700">{totals.calls}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-emerald-700">{totals.visits}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-teal-700">{totals.online}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-amber-700">{totals.walkIn}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-slate-800">{totals.total}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-emerald-700">{totals.leadsCount}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-bold text-slate-600">{activeProsCount} active</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                /* ── Detail View ── */
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-600" />
                      All Updates
                      <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-bold ml-auto">
                        {updates.length} update{updates.length !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-3">
                    {updates.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <Activity className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-400">No updates for the selected period</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[60vh]">
                        <motion.div
                          variants={container}
                          initial="hidden"
                          animate="show"
                          className="space-y-1.5"
                        >
                          {updates.map((update: any) => (
                            <motion.div
                              key={update.id}
                              variants={itemVariant}
                              className="flex items-start justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <div className={cn(
                                    "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                                    update.approachType === 'PHONE' ? 'bg-sky-100 text-sky-600' :
                                    update.approachType === 'DOORSTEP' ? 'bg-emerald-100 text-emerald-600' :
                                    update.approachType === 'WALK_IN' ? 'bg-teal-100 text-teal-600' :
                                    update.approachType === 'ONLINE' ? 'bg-blue-100 text-blue-600' :
                                    'bg-slate-100 text-slate-500'
                                  )}>
                                    {APPROACH_ICONS[update.approachType as string] || <Activity className="h-2.5 w-2.5" />}
                                  </div>
                                  <span className="text-[11px] font-medium text-slate-700">{update.loggedByName}</span>
                                  <Badge className={cn(
                                    "text-[9px] border font-medium",
                                    APPROACH_COLORS[update.approachType as string] || 'border-slate-200 text-slate-600'
                                  )}>
                                    {update.approachType}
                                  </Badge>
                                  <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-0 font-medium">
                                    {update.statusLabel || update.statusCode}
                                  </Badge>
                                </div>
                                {update.comments && (
                                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{update.comments}</p>
                                )}
                                {update.gpsCaptured && update.gpsLocation && (
                                  <p className="text-[10px] text-sky-500 mt-0.5 font-mono">
                                    📍 {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 ml-2 whitespace-nowrap">
                                {formatReportDate(update.createdAt)}
                              </span>
                            </motion.div>
                          ))}
                        </motion.div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ── Expanded PRO Updates Panel ── */}
              <AnimatePresence>
                {expandedPro && proUpdatesMap[expandedPro] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="border-0 shadow-sm border-t-2 border-t-emerald-200">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <Eye className="h-4 w-4 text-emerald-600" />
                          {proSummary.find(p => p.uid === expandedPro)?.name} — Activity Details
                          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-bold ml-auto">
                            {proUpdatesMap[expandedPro].length} update{proUpdatesMap[expandedPro].length !== 1 ? 's' : ''}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-2 pb-3">
                        <ScrollArea className="max-h-[40vh]">
                          <div className="space-y-1.5">
                            {proUpdatesMap[expandedPro].map((update: any) => (
                              <div
                                key={update.id}
                                className="flex items-start justify-between px-3 py-2 rounded-lg bg-slate-50/50 border border-slate-100"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <div className={cn(
                                      "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                                      update.approachType === 'PHONE' ? 'bg-sky-100 text-sky-600' :
                                      update.approachType === 'DOORSTEP' ? 'bg-emerald-100 text-emerald-600' :
                                      update.approachType === 'WALK_IN' ? 'bg-teal-100 text-teal-600' :
                                      'bg-blue-100 text-blue-600'
                                    )}>
                                      {APPROACH_ICONS[update.approachType as string] || <Activity className="h-2.5 w-2.5" />}
                                    </div>
                                    <Badge className={cn("text-[9px] border font-medium", APPROACH_COLORS[update.approachType as string] || 'border-slate-200 text-slate-600')}>
                                      {update.approachType}
                                    </Badge>
                                    <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-0 font-medium">
                                      {update.statusLabel || update.statusCode}
                                    </Badge>
                                  </div>
                                  {update.comments && (
                                    <p className="text-[11px] text-slate-500 mt-1">{update.comments}</p>
                                  )}
                                  {update.gpsCaptured && update.gpsLocation && (
                                    <p className="text-[10px] text-sky-500 mt-0.5 font-mono">
                                      📍 {update.gpsLocation.lat.toFixed(4)}, {update.gpsLocation.lng.toFixed(4)}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 shrink-0 ml-2 whitespace-nowrap">
                                  {formatReportDate(update.createdAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ──── PRO PERFORMANCE TAB ──── */}
          {reportTab === 'performance' && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {proSummary.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">No PRO data for the selected period</p>
                    <p className="text-xs text-slate-300 mt-1">PRO activity will appear here as they log updates</p>
                  </CardContent>
                </Card>
              ) : (
                proSummary.map((pro, idx) => {
                  const proTeam = teams.find(t => t.memberUids.includes(pro.uid));
                  const proDivs = proTeam
                    ? divisions.filter(d => proTeam.divisionIds.includes(d.id))
                    : divisions.filter(d => pro.assignedDivisionIds?.includes(d.id));
                  const hasUpdates = pro.total > 0;
                  const maxTotal = proSummary[0]?.total || 1;
                  const barWidth = Math.max((pro.total / maxTotal) * 100, pro.total > 0 ? 8 : 0);

                  return (
                    <motion.div
                      key={pro.uid}
                      variants={itemVariant}
                      initial="hidden"
                      animate="show"
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={cn(
                        "border-0 shadow-sm overflow-hidden transition-all",
                        hasUpdates ? "hover:shadow-md" : "opacity-60"
                      )}>
                        <CardContent className="p-0">
                          <div className="flex">
                            {/* Rank badge */}
                            <div className={cn(
                              "w-10 shrink-0 flex items-center justify-center",
                              idx === 0 && hasUpdates ? "bg-gradient-to-b from-emerald-500 to-emerald-600" :
                              idx === 1 && hasUpdates ? "bg-gradient-to-b from-teal-400 to-teal-500" :
                              idx === 2 && hasUpdates ? "bg-gradient-to-b from-amber-400 to-amber-500" :
                              "bg-slate-100"
                            )}>
                              <span className={cn(
                                "text-sm font-bold",
                                idx < 3 && hasUpdates ? "text-white" : "text-slate-400"
                              )}>
                                {idx + 1}
                              </span>
                            </div>

                            <div className="flex-1 p-3">
                              {/* PRO Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-emerald-700">{pro.name.charAt(0)}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{pro.name}</p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {proTeam && (
                                        <span className="text-[10px] text-teal-600 font-medium">{proTeam.name}</span>
                                      )}
                                      {proDivs.length > 0 && (
                                        <span className="text-[10px] text-slate-400">
                                          {proDivs.map(d => d.code).join(', ')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge className={cn(
                                    "text-[10px] font-bold border-0",
                                    hasUpdates
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-200 text-slate-500"
                                  )}>
                                    {pro.total} update{pro.total !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barWidth}%` }}
                                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                                />
                              </div>

                              {/* Activity breakdown */}
                              <div className="grid grid-cols-6 gap-1.5">
                                {[
                                  { label: 'Calls', value: pro.calls, color: 'bg-sky-50 text-sky-700' },
                                  { label: 'Visits', value: pro.visits, color: 'bg-emerald-50 text-emerald-700' },
                                  { label: 'Online', value: pro.online, color: 'bg-teal-50 text-teal-700' },
                                  { label: 'Walk-in', value: pro.walkIn, color: 'bg-amber-50 text-amber-700' },
                                  { label: 'Leads', value: pro.leadsCount, color: 'bg-emerald-50 text-emerald-700' },
                                  { label: 'Hours', value: pro.firstActivity && pro.lastActivity ? (() => {
                                    try {
                                      const f = pro.firstActivity?.toDate?.() || new Date(pro.firstActivity);
                                      const l = pro.lastActivity?.toDate?.() || new Date(pro.lastActivity);
                                      const hrs = Math.round((l.getTime() - f.getTime()) / (1000 * 60 * 60) * 10) / 10;
                                      return `${hrs}h`;
                                    } catch { return '—'; }
                                  })() : '—', color: 'bg-slate-50 text-slate-600' },
                                ].map(stat => (
                                  <div key={stat.label} className={cn("rounded-lg px-2 py-1 text-center", stat.color)}>
                                    <p className="text-[9px] font-medium opacity-70">{stat.label}</p>
                                    <p className="text-xs font-bold">{stat.value}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Activity time range */}
                              {hasUpdates && (
                                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatShortTime(pro.firstActivity)}</span>
                                  <span>→</span>
                                  <span>{formatShortTime(pro.lastActivity)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ──── AREA SUMMARY TAB ──── */}
          {reportTab === 'area' && (
            <motion.div
              key="area"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {areaSummary.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <MapPin className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-400">No area data for the selected period</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Area cards */}
                  {areaSummary.map((area, idx) => {
                    const maxAreaTotal = areaSummary[0]?.total || 1;
                    const barWidth = Math.max((area.total / maxAreaTotal) * 100, area.total > 0 ? 8 : 0);
                    return (
                      <motion.div
                        key={area.divisionId}
                        variants={itemVariant}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className="border-0 shadow-sm overflow-hidden">
                          <CardContent className="p-0">
                            <div className="flex">
                              {/* Left accent */}
                              <div className={cn(
                                "w-1.5 shrink-0",
                                area.total > 0 ? "bg-gradient-to-b from-emerald-500 to-teal-400" : "bg-slate-200"
                              )} />

                              <div className="flex-1 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                      <MapPin className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-800 truncate">{area.divisionName}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">{area.divisionCode}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0 font-bold">
                                      <UserCheck className="h-2.5 w-2.5 mr-0.5" />
                                      {area.activePros} PRO{area.activePros !== 1 ? 's' : ''}
                                    </Badge>
                                    {area.total > 0 && (
                                      <Badge className="text-[10px] bg-slate-100 text-slate-700 border-0 font-bold">
                                        {area.total} update{area.total !== 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Progress bar */}
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barWidth}%` }}
                                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                                  />
                                </div>

                                {/* Breakdown */}
                                <div className="grid grid-cols-5 gap-1.5">
                                  {[
                                    { label: 'Calls', value: area.calls, color: 'bg-sky-50 text-sky-700' },
                                    { label: 'Visits', value: area.visits, color: 'bg-emerald-50 text-emerald-700' },
                                    { label: 'Online', value: area.online, color: 'bg-teal-50 text-teal-700' },
                                    { label: 'Walk-in', value: area.walkIn, color: 'bg-amber-50 text-amber-700' },
                                    { label: 'Leads', value: area.leadsCount, color: 'bg-emerald-50 text-emerald-700' },
                                  ].map(stat => (
                                    <div key={stat.label} className={cn("rounded-lg px-2 py-1 text-center", stat.color)}>
                                      <p className="text-[9px] font-medium opacity-70">{stat.label}</p>
                                      <p className="text-xs font-bold">{stat.value}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}

                  {/* Area Comparison Table */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-emerald-600" />
                        Area Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-3">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Area</TableHead>
                              <TableHead className="text-[10px] text-center">Calls</TableHead>
                              <TableHead className="text-[10px] text-center">Visits</TableHead>
                              <TableHead className="text-[10px] text-center">Online</TableHead>
                              <TableHead className="text-[10px] text-center">Walk-in</TableHead>
                              <TableHead className="text-[10px] text-center">Total</TableHead>
                              <TableHead className="text-[10px] text-center">Leads</TableHead>
                              <TableHead className="text-[10px] text-center">PROs</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {areaSummary.map(area => (
                              <TableRow key={area.divisionId}>
                                <TableCell className="text-xs font-medium text-slate-800 py-2">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 text-emerald-500" />
                                    <span>{area.divisionName}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({area.divisionCode})</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-center py-2">
                                  <Badge className="bg-sky-50 text-sky-700 border-0 text-[10px] font-bold">{area.calls}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center py-2">
                                  <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-bold">{area.visits}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center py-2">
                                  <Badge className="bg-teal-50 text-teal-700 border-0 text-[10px] font-bold">{area.online}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center py-2">
                                  <Badge className="bg-amber-50 text-amber-700 border-0 text-[10px] font-bold">{area.walkIn}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center py-2 font-bold text-slate-800">{area.total}</TableCell>
                                <TableCell className="text-xs text-center py-2">
                                  <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-bold">{area.leadsCount}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-center py-2">
                                  <Badge className="bg-teal-50 text-teal-700 border-0 text-[10px] font-bold">{area.activePros}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
