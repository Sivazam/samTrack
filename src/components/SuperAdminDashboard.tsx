'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { LogoutConfirmDialog } from '@/components/ui/LogoutConfirmDialog';
import { cn } from '@/lib/utils';
import {
  GraduationCap, Users, Plus, LogOut, Eye, UserCheck, Loader2,
  UserPlus, Shield, ShieldCheck, UserCog, ToggleLeft, ToggleRight,
  Search, Pencil, RefreshCw, ArrowUpRight, ArrowDownRight, Calendar,
  ChevronRight, X, Building2, Clock
} from 'lucide-react';
import { Tenant, User, Role } from '@/types';
import {
  adminCreateTenantViaCloudFunction,
  adminUpdateTenantViaCloudFunction,
  createUserViaCloudFunction,
  updateUserViaCloudFunction,
  deactivateUserViaCloudFunction
} from '@/lib/cloud-functions';

// ─── Helper Functions ─────────────────────────────────────────────────────────

// Fake sparkline data — deterministic per label
function getSparkline(label: string): number[] {
  const seeds: Record<string, number[]> = {
    'Colleges': [2, 3, 3, 4, 5, 4, 6, 7, 8, 7],
    'Active': [1, 2, 3, 3, 4, 5, 4, 6, 5, 7],
    'Total Users': [5, 8, 10, 14, 18, 22, 26, 30, 35, 40],
    'PROs': [3, 5, 6, 8, 10, 9, 12, 14, 16, 15],
  };
  return seeds[label] || [4, 6, 5, 7, 6, 8, 5, 7, 9, 6];
}

// Fake percentage change based on stat value (deterministic)
function getPercentChange(value: number): { pct: number; up: boolean } {
  if (value === 0) return { pct: 0, up: true };
  const pct = ((value * 7 + 3) % 25) + 1;
  const up = value % 3 !== 0;
  return { pct, up };
}

// Status border gradient color
function getStatusBorder(status?: string): string {
  switch (status) {
    case 'ACTIVE': return 'border-l-emerald-500';
    case 'PENDING': return 'border-l-amber-500';
    case 'SUSPENDED': return 'border-l-red-500';
    default: return 'border-l-slate-400';
  }
}

function getStatusBorderColor(status?: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-500';
    case 'PENDING': return 'bg-amber-500';
    case 'SUSPENDED': return 'bg-red-500';
    default: return 'bg-slate-400';
  }
}

function getStatusDotColor(status?: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-400';
    case 'PENDING': return 'bg-amber-400';
    case 'SUSPENDED': return 'bg-red-400';
    default: return 'bg-slate-400';
  }
}

function formatDateShort(date: any): string {
  if (!date) return '—';
  try {
    const d = date?.toDate?.() || new Date(date);
    if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const floatAnimation = {
  animate: { y: [0, -8, 0] },
  transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load tenants
  useEffect(() => {
    const unsub: Unsubscribe = onSnapshot(collection(db, 'tenants'), snap => {
      setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      setLoading(false);
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setTenants([]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load all users
  useEffect(() => {
    const unsub: Unsubscribe = onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setUsers([]);
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SUSPENDED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <Shield className="h-3 w-3" />, label: 'Super Admin' };
      case 'COLLEGE_ADMIN': return { color: 'bg-sky-100 text-sky-800 border-sky-200', icon: <ShieldCheck className="h-3 w-3" />, label: 'College Admin' };
      case 'MANAGER': return { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: <UserCog className="h-3 w-3" />, label: 'Manager' };
      case 'PRO': return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <UserCheck className="h-3 w-3" />, label: 'PRO' };
      default: return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: <Users className="h-3 w-3" />, label: role };
    }
  };

  const filteredTenants = tenants.filter(t =>
    !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTenants = tenants.filter(t => t.status === 'ACTIVE').length;
  const totalUsers = users.length;
  const totalPros = users.filter(u => u.role === 'PRO').length;

  // ─── KPI Cards Config ───────────────────────────────────────────────────

  const kpiCards = [
    { label: 'Colleges', value: tenants.length, icon: GraduationCap, gradient: 'from-emerald-500 to-teal-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
    { label: 'Active', value: activeTenants, icon: UserCheck, gradient: 'from-sky-500 to-cyan-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
    { label: 'Total Users', value: totalUsers, icon: Users, gradient: 'from-teal-500 to-emerald-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
    { label: 'PROs', value: totalPros, icon: UserCog, gradient: 'from-cyan-500 to-sky-600', iconBg: 'bg-white/20 text-white', sparkColor: 'bg-white/40' },
  ];

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-gradient-to-br from-emerald-50/30 via-white to-sky-50/20"
    >
      <LogoutConfirmDialog
        open={showLogoutConfirm}
        loading={loggingOut}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          try { await logout(); } finally { setLoggingOut(false); setShowLogoutConfirm(false); }
        }}
      />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-emerald-600 to-teal-500 shadow-md">
        {/* Refresh progress bar */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 1, opacity: 0 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              className="absolute top-0 left-0 right-0 h-1 bg-emerald-300/60 origin-left"
            >
              <div className="h-full w-1/3 bg-white/40 animate-pulse rounded-full" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-white/20 rounded-lg flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Samhitha Admissions</h1>
              <p className="text-xs text-emerald-100 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Super Admin Panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-white/80 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-white">
              <div className="h-7 w-7 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-white">{user?.displayName?.charAt(0)?.toUpperCase() || 'S'}</span>
              </div>
              <span className="font-medium">{user?.displayName || 'Super Admin'}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowLogoutConfirm(true)} className="text-white/80 hover:text-white hover:bg-white/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Stats Cards with Gradient + Sparklines */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div key={`skel-${i}`} variants={itemVariants}>
                  <SkeletonKPICard />
                </motion.div>
              ))
            : kpiCards.map((card) => {
                const Icon = card.icon;
                const value = card.value;
                const change = getPercentChange(value);
                const sparkData = getSparkline(card.label);
                const maxSpark = Math.max(...sparkData, 1);
                return (
                  <motion.div
                    key={card.label}
                    variants={itemVariants}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-lg transition-shadow cursor-default">
                      <div className={`bg-gradient-to-br ${card.gradient} p-3.5 rounded-xl`} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-medium text-white/80">{card.label}</p>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
                              {change.pct > 0 && (
                                <span className={cn(
                                  "flex items-center text-[10px] font-semibold px-1 py-0.5 rounded-md",
                                  change.up ? "bg-emerald-800/30 text-emerald-100" : "bg-red-900/30 text-red-200"
                                )}>
                                  {change.up ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
                                  {change.pct}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${card.iconBg}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        {/* Sparkline mini bars */}
                        <div className="flex items-end gap-[3px] mt-2 h-5">
                          {sparkData.map((val, i) => (
                            <div
                              key={i}
                              className={cn("flex-1 rounded-sm min-h-[3px]", card.sparkColor)}
                              style={{ height: `${(val / maxSpark) * 100}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
          }
        </motion.div>

        {/* College List Header + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2 text-slate-900">
            <GraduationCap className="h-4 w-4 text-emerald-600" /> Colleges
            <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{tenants.length}</Badge>
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search colleges..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 h-9 text-sm rounded-full bg-white border-slate-200 focus:border-emerald-400 focus:ring-emerald-400/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-emerald-600 hover:bg-emerald-700 shrink-0 shadow-sm shadow-emerald-200/50">
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </div>
        </div>

        {/* College Cards / Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-sm text-slate-400">Loading colleges...</p>
          </div>
        ) : tenants.length === 0 ? (
          /* ─── Animated Empty State ────────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-12 text-center">
                <motion.div {...floatAnimation} className="inline-block">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-5">
                    <GraduationCap className="h-10 w-10 text-emerald-600" />
                  </div>
                </motion.div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">No colleges yet</h3>
                <p className="text-sm text-slate-400 max-w-xs mx-auto mb-5">
                  Create your first college to start managing admissions and tracking performance.
                </p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200/50"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Create Your First College
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : filteredTenants.length === 0 ? (
          /* ─── No Search Results ──────────────────────────────────────── */
          <Card className="border-0 shadow-sm">
            <CardContent className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-slate-300" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">No colleges found</h3>
              <p className="text-sm text-slate-400 mb-4">Try a different search term</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear Search
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* ─── College Cards Grid ─────────────────────────────────────── */
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {filteredTenants.map((tenant) => {
              const tenantUsers = users.filter(u => u.tenantId === tenant.id);
              const adminCount = tenantUsers.filter(u => u.role === 'COLLEGE_ADMIN').length;
              const managerCount = tenantUsers.filter(u => u.role === 'MANAGER').length;
              const proCount = tenantUsers.filter(u => u.role === 'PRO').length;
              const isActive = tenant.status === 'ACTIVE';
              const borderColor = getStatusBorder(tenant.status);
              const dotColor = getStatusDotColor(tenant.status);

              return (
                <motion.div
                  key={tenant.id}
                  variants={cardVariants}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="cursor-pointer"
                  onClick={() => setSelectedTenant(tenant)}
                >
                  <Card className={cn(
                    "border-0 shadow-sm hover:shadow-md transition-all overflow-hidden border-l-4",
                    borderColor
                  )}>
                    <CardContent className="p-4">
                      {/* Top: College Name + Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-10 w-10 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center shrink-0">
                            <GraduationCap className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{tenant.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">{tenant.id}</p>
                          </div>
                        </div>
                        <Badge className={cn("border text-[10px] px-2 py-0.5 shrink-0", getStatusColor(tenant.status))}>
                          <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", dotColor)} />
                          {tenant.status}
                        </Badge>
                      </div>

                      {/* Mini Stat Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-sky-50 text-sky-700 px-2 py-1 rounded-md">
                          <Users className="h-3 w-3" /> {tenantUsers.length} users
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">
                          <UserCheck className="h-3 w-3" /> {proCount} PROs
                        </span>
                        {adminCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-50 text-slate-600 px-2 py-1 rounded-md">
                            <ShieldCheck className="h-3 w-3" /> {adminCount} admin
                          </span>
                        )}
                      </div>

                      {/* Bottom: Created Date + Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="h-3 w-3" />
                          {formatDateShort(tenant.createdAt)}
                        </span>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTenant(tenant)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-600"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const newStatus = isActive ? 'SUSPENDED' : 'ACTIVE';
                              await adminUpdateTenantViaCloudFunction({ tenantId: tenant.id, updateData: { status: newStatus } });
                            }}
                            className={cn("h-7 w-7 p-0", isActive ? "text-slate-400 hover:text-red-600" : "text-slate-400 hover:text-emerald-600")}
                          >
                            {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Summary Stats Bar */}
        {!loading && tenants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-emerald-50/30">
              <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> {activeTenants} Active
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> {tenants.filter(t => t.status === 'PENDING').length} Pending
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> {tenants.filter(t => t.status === 'SUSPENDED').length} Suspended
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Users className="h-3 w-3" /> {totalUsers} total users across {tenants.length} colleges
                </span>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Create Tenant Dialog */}
      <AnimatePresence>
        {showCreate && <CreateTenantDialog onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

      {/* Tenant Details Dialog with User Management */}
      <AnimatePresence>
        {selectedTenant && (
          <TenantDetailsDialog
            tenant={selectedTenant}
            users={users.filter(u => u.tenantId === selectedTenant.id)}
            onClose={() => setSelectedTenant(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tenant Details Dialog with User Management
// ═══════════════════════════════════════════════════════════════════════════════

function TenantDetailsDialog({
  tenant,
  users,
  onClose
}: {
  tenant: Tenant;
  users: User[];
  onClose: () => void;
}) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'COLLEGE_ADMIN': return { color: 'bg-sky-100 text-sky-800 border-sky-200', icon: <ShieldCheck className="h-3 w-3" />, label: 'Admin' };
      case 'MANAGER': return { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: <UserCog className="h-3 w-3" />, label: 'Manager' };
      case 'PRO': return { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: <UserCheck className="h-3 w-3" />, label: 'PRO' };
      default: return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: <Users className="h-3 w-3" />, label: role };
    }
  };

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.username?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const adminCount = users.filter(u => u.role === 'COLLEGE_ADMIN').length;
  const managerCount = users.filter(u => u.role === 'MANAGER').length;
  const proCount = users.filter(u => u.role === 'PRO').length;
  const activeCount = users.filter(u => u.active).length;

  return (
    <>
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="flex flex-col max-h-[90vh]">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-4 rounded-t-lg shrink-0" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{tenant.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={cn("border text-[10px] px-2 py-0.5", getStatusColor(tenant.status))}>
                      {tenant.status}
                    </Badge>
                    <span className="text-[11px] text-emerald-100 font-mono">{tenant.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col px-6 pb-4">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-2 py-4">
                <div className="bg-gradient-to-br from-sky-50 to-sky-100/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-sky-600 font-medium">Admins</p>
                  <p className="text-lg font-bold text-sky-700">{adminCount}</p>
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-cyan-600 font-medium">Managers</p>
                  <p className="text-lg font-bold text-cyan-700">{managerCount}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-emerald-600 font-medium">PROs</p>
                  <p className="text-lg font-bold text-emerald-700">{proCount}</p>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl p-2.5 text-center">
                  <p className="text-[10px] text-teal-600 font-medium">Active</p>
                  <p className="text-lg font-bold text-teal-700">{activeCount}/{users.length}</p>
                </div>
              </div>

              {/* Users Header */}
              <div className="flex items-center justify-between pb-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-full border-slate-200 focus:border-emerald-400"
                  />
                  {userSearch && (
                    <button onClick={() => setUserSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
                <Button size="sm" onClick={() => setShowAddUser(true)} className="bg-emerald-600 hover:bg-emerald-700 ml-2 shadow-sm shadow-emerald-200/50">
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Add User
                </Button>
              </div>

              {/* Users List */}
              <ScrollArea className="flex-1 min-h-0">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Users className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500">No users found</p>
                    <p className="text-xs text-slate-400 mt-1">Add users to this college</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredUsers.map((u, idx) => {
                      const roleBadge = getRoleBadge(u.role);
                      return (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="flex items-center justify-between border rounded-xl p-2.5 hover:bg-slate-50/50 transition-colors border-slate-100"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                              {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-slate-900 truncate">{u.displayName}</p>
                                {!u.active && (
                                  <Badge className="bg-red-100 text-red-700 border border-red-200 text-[10px] px-1.5 py-0">Inactive</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate">{u.email} · @{u.username}{u.phone ? ` · ${u.phone}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <Badge className={`${roleBadge.color} border text-[10px] px-1.5 py-0 flex items-center gap-1`}>
                              {roleBadge.icon} {roleBadge.label}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-emerald-600"
                              onClick={() => setEditingUser(u)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      {showAddUser && (
        <CreateUserForTenantDialog
          tenantId={tenant.id}
          tenantName={tenant.name || ''}
          onClose={() => setShowAddUser(false)}
        />
      )}

      {/* Edit User Dialog */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          tenantId={tenant.id}
          onClose={() => setEditingUser(null)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Create User for a Specific Tenant (Super Admin)
// ═══════════════════════════════════════════════════════════════════════════════

function CreateUserForTenantDialog({
  tenantId,
  tenantName,
  onClose
}: {
  tenantId: string;
  tenantName: string;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
    role: 'PRO' as Role,
    phone: ''
  });

  const handleSubmit = async () => {
    setError('');
    if (!form.email || !form.username || !form.password || !form.displayName) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (form.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    setSubmitting(true);
    try {
      await createUserViaCloudFunction({
        ...form,
        tenantId,
      });
      onClose();
    } catch (e: any) {
      const msg = e?.message || e?.details?.message || 'Failed to create user';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-4" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-bold">Add User</DialogTitle>
                <DialogDescription className="text-emerald-100 text-xs mt-0.5">Create a new account for {tenantName}</DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">Display Name *</Label>
                <Input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="Full Name"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@college.edu"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Username *</Label>
                  <Input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') }))}
                    placeholder="lowercase, 3-30 chars"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Password *</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="10-digit mobile"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Role *</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRO">
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> PRO (Field Officer)
                      </span>
                    </SelectItem>
                    <SelectItem value="MANAGER">
                      <span className="flex items-center gap-2">
                        <UserCog className="h-3.5 w-3.5 text-cyan-600" /> Manager (Team Lead)
                      </span>
                    </SelectItem>
                    <SelectItem value="COLLEGE_ADMIN">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-sky-600" /> College Admin
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.email || !form.username || !form.password || !form.displayName} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200/50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create User
              </Button>
            </DialogFooter>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Edit User Dialog
// ═══════════════════════════════════════════════════════════════════════════════

function EditUserDialog({
  user,
  tenantId,
  onClose
}: {
  user: User;
  tenantId: string;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    phone: user.phone || '',
    role: user.role || 'PRO',
    active: user.active !== false,
  });

  const handleSubmit = async () => {
    setError('');
    if (!form.displayName) {
      setError('Display name is required');
      return;
    }
    setSubmitting(true);
    try {
      await updateUserViaCloudFunction({
        userId: user.id,
        displayName: form.displayName,
        phone: form.phone || undefined,
        role: form.role,
        active: form.active,
      });
      onClose();
    } catch (e: any) {
      const msg = e?.message || e?.details?.message || 'Failed to update user';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim());
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    setError('');
    setSubmitting(true);
    try {
      await deactivateUserViaCloudFunction({ userId: user.id });
      onClose();
    } catch (e: any) {
      const msg = e?.message || 'Failed to deactivate user';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-teal-500 via-emerald-500 to-emerald-600 px-6 py-4" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Pencil className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-bold">Edit User</DialogTitle>
                <DialogDescription className="text-emerald-100 text-xs mt-0.5">Update details for {user.displayName}</DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-600">Display Name</Label>
                <Input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Email</Label>
                <Input
                  value={user.email || ''}
                  disabled
                  className="mt-1 bg-slate-50"
                />
                <p className="text-[10px] text-slate-400 mt-1">Email cannot be changed</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Role</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as Role }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRO">PRO</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="COLLEGE_ADMIN">College Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between border rounded-xl p-3 border-slate-100">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Account Status</Label>
                  <p className="text-xs text-slate-400">{form.active ? 'User can log in and use the system' : 'User is deactivated and cannot log in'}</p>
                </div>
                <Button
                  variant={form.active ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={form.active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'bg-emerald-600 hover:bg-emerald-700'}
                >
                  {form.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200/50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save Changes
              </Button>
            </DialogFooter>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Create Tenant Dialog (enhanced with step indicators + gradient header)
// ═══════════════════════════════════════════════════════════════════════════════

function CreateTenantDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminDisplayName, setAdminDisplayName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canGoNext = step === 1 ? !!name : !!(adminEmail && adminPassword);
  const totalSteps = 2;

  const handleNext = () => {
    if (step === 1 && !name) {
      setError('College name is required');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async () => {
    setError('');
    if (!name || !adminEmail || !adminPassword) {
      setError('College name, admin email, and password are required');
      return;
    }
    if (adminPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSubmitting(true);
    try {
      await adminCreateTenantViaCloudFunction({
        name,
        adminEmail,
        adminPassword,
        adminDisplayName: adminDisplayName || adminEmail.split('@')[0],
        adminUsername: adminUsername || 'admin',
        adminPhone: adminPhone || undefined,
      });
      onClose();
    } catch (e: any) {
      const msg = e?.message || e?.details?.message || 'Failed to create college';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)\.?/, '').trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}>
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-6 py-4" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08)' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-base font-bold">Create New College</DialogTitle>
                <DialogDescription className="text-emerald-100 text-xs mt-0.5">Set up a new college with its admin</DialogDescription>
              </div>
            </div>
            {/* Step Indicators */}
            <div className="flex items-center gap-2 mt-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                    step > i + 1
                      ? "bg-white text-emerald-600"
                      : step === i + 1
                        ? "bg-white/25 text-white ring-2 ring-white/50"
                        : "bg-white/10 text-white/50"
                  )}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  {i < totalSteps - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 rounded-full transition-all",
                      step > i + 1 ? "bg-white" : "bg-white/20"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-slate-800">College Information</h3>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600">College Name *</Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Samhitha College of Engineering"
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-slate-400">Enter the official college name. This will be visible to all users.</p>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="h-4 w-4 text-sky-600" />
                    <h3 className="text-sm font-semibold text-slate-800">First Admin Account</h3>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Admin Display Name</Label>
                    <Input value={adminDisplayName} onChange={e => setAdminDisplayName(e.target.value)} placeholder="Dr. Ramesh Kumar" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Email *</Label>
                      <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@college.edu" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Username</Label>
                      <Input value={adminUsername} onChange={e => setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} placeholder="admin" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Password *</Label>
                      <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Phone</Label>
                      <Input value={adminPhone} onChange={e => setAdminPhone(e.target.value)} placeholder="9876543210" className="mt-1" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <DialogFooter className="gap-2 mt-6 pt-4 border-t border-slate-100">
              {step === 1 ? (
                <>
                  <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
                  <Button onClick={handleNext} disabled={!name} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200/50">
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setStep(1); setError(''); }} disabled={submitting}>Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting || !adminEmail || !adminPassword} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200/50">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Create College
                  </Button>
                </>
              )}
            </DialogFooter>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reused helper for TenantDetailsDialog ─────────────────────────────────

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'PENDING': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'SUSPENDED': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
