'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { FileText, Loader2, BarChart3, Users, MapPin, Clock } from 'lucide-react';
import { generateReportViaCloudFunction } from '@/lib/cloud-functions';

type ReportType = 'daily_activity' | 'status_funnel' | 'overdue_followups' | 'division_summary';

// ─── Sub-renderers for each report type ───────────────────────────

function DailyActivityTable({ data }: { data: any }) {
  const rows = Array.isArray(data) ? data : data?.rows ?? [];
  if (rows.length === 0) return <EmptyState />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>PRO Name</TableHead>
          <TableHead className="text-right">Leads Contacted</TableHead>
          <TableHead className="text-right">Updates Logged</TableHead>
          <TableHead className="text-right">Doorstep Visits</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row: any, i: number) => (
          <TableRow key={i}>
            <TableCell>{row.date ?? '—'}</TableCell>
            <TableCell>{row.proName ?? row.proDisplayName ?? '—'}</TableCell>
            <TableCell className="text-right">{row.leadsContacted ?? row.contacts ?? 0}</TableCell>
            <TableCell className="text-right">{row.updatesLogged ?? row.statusUpdates ?? 0}</TableCell>
            <TableCell className="text-right">{row.doorstepVisits ?? row.visits ?? 0}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatusFunnelView({ data }: { data: any }) {
  const rows = Array.isArray(data) ? data : data?.rows ?? [];
  if (rows.length === 0) return <EmptyState />;

  // Sort by count descending
  const sorted = [...rows].sort((a: any, b: any) =>
    (b.count ?? b.total ?? 0) - (a.count ?? a.total ?? 0)
  );
  const maxCount = Math.max(...sorted.map((r: any) => r.count ?? r.total ?? 0), 1);

  return (
    <div className="space-y-2">
      {sorted.map((row: any, i: number) => {
        const count = row.count ?? row.total ?? 0;
        const pct = Math.round((count / maxCount) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <Badge variant="outline" className="w-32 shrink-0 justify-center text-xs font-mono">
              {row.status ?? row.statusCode ?? row.statusLabel ?? '—'}
            </Badge>
            <div className="flex-1 h-7 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium w-12 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function OverdueFollowupsList({ data }: { data: any }) {
  const rows = Array.isArray(data) ? data : data?.rows ?? [];
  if (rows.length === 0) return <EmptyState />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Lead Name</TableHead>
          <TableHead>Assigned PRO</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Days Overdue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row: any, i: number) => {
          const dueDate = row.dueDate ?? row.nextFollowupAt ?? row.dueAt ?? null;
          const daysOverdue = row.daysOverdue ?? (dueDate ? Math.max(0, Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000)) : '—');
          return (
            <TableRow key={i}>
              <TableCell className="font-medium">{row.leadName ?? row.parentName ?? '—'}</TableCell>
              <TableCell>{row.assignedPRO ?? row.proName ?? row.proDisplayName ?? '—'}</TableCell>
              <TableCell>{dueDate ? formatReportDate(dueDate) : '—'}</TableCell>
              <TableCell>
                <Badge variant={typeof daysOverdue === 'number' && daysOverdue > 3 ? 'destructive' : 'secondary'}>
                  {typeof daysOverdue === 'number' ? `${daysOverdue}d` : daysOverdue}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function DivisionSummaryTable({ data }: { data: any }) {
  const rows = Array.isArray(data) ? data : data?.rows ?? [];
  if (rows.length === 0) return <EmptyState />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Division</TableHead>
          <TableHead className="text-right">Total Leads</TableHead>
          <TableHead className="text-right">Active Leads</TableHead>
          <TableHead className="text-right">Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row: any, i: number) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{row.divisionName ?? row.division ?? '—'}</TableCell>
            <TableCell className="text-right">{row.totalLeads ?? row.total ?? 0}</TableCell>
            <TableCell className="text-right">{row.activeLeads ?? row.active ?? 0}</TableCell>
            <TableCell className="text-right">
              <Badge variant="default">{row.joinedCount ?? row.joined ?? 0}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EmptyState() {
  return (
    <div className="py-8 text-center text-muted-foreground text-sm">
      No data available for this report.
    </div>
  );
}

function formatReportDate(value: any): string {
  try {
    if (!value) return '—';
    // Handle Firestore Timestamp objects
    if (value?.seconds !== undefined) {
      return new Date(value.seconds * 1000).toLocaleDateString();
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  } catch {
    return String(value);
  }
}

// ─── Report renderer switch ───────────────────────────────────────

function ReportContent({ reportType, report }: { reportType: ReportType; report: any }) {
  // The cloud function may return { success, data } or the data directly
  const payload = report?.data ?? report;

  switch (reportType) {
    case 'daily_activity':
      return <DailyActivityTable data={payload} />;
    case 'status_funnel':
      return <StatusFunnelView data={payload} />;
    case 'overdue_followups':
      return <OverdueFollowupsList data={payload} />;
    case 'division_summary':
      return <DivisionSummaryTable data={payload} />;
    default:
      return <RawJsonFallback data={report} />;
  }
}

function RawJsonFallback({ data }: { data: any }) {
  return (
    <ScrollArea className="h-[50vh]">
      <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </ScrollArea>
  );
}

// ─── Main component ───────────────────────────────────────────────

const REPORT_META: Record<ReportType, { label: string; icon: React.ReactNode; description: string }> = {
  daily_activity: {
    label: 'Daily Activity',
    icon: <Clock className="h-4 w-4" />,
    description: 'PRO activity breakdown by date',
  },
  status_funnel: {
    label: 'Status Funnel',
    icon: <BarChart3 className="h-4 w-4" />,
    description: 'Lead counts by current status',
  },
  overdue_followups: {
    label: 'Overdue Follow-ups',
    icon: <Users className="h-4 w-4" />,
    description: 'Leads past their follow-up due date',
  },
  division_summary: {
    label: 'Division Summary',
    icon: <MapPin className="h-4 w-4" />,
    description: 'Lead distribution across divisions',
  },
};

export function ReportsPanel() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('daily_activity');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateReportViaCloudFunction({
        type: reportType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setReport(result);
    } catch (e: any) {
      setError(e.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  const meta = REPORT_META[reportType];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Reports</h2>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Report Type</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REPORT_META) as ReportType[]).map((key) => (
                  <SelectItem key={key} value={key}>{REPORT_META[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label className="text-xs">End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BarChart3 className="h-4 w-4 mr-1" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {report && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {meta.icon}
              {meta.label}
              <span className="text-muted-foreground font-normal text-xs ml-1">— {meta.description}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[50vh]">
              <ReportContent reportType={reportType} report={report} />
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={`text-xs font-medium ${className || ''}`}>{children}</label>;
}
