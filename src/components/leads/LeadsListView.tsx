'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe, Timestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, MapPin, Calendar, Phone, RefreshCw, Filter,
  X, PhoneCall, Users, AlertCircle, FileUp, Check, GraduationCap
} from 'lucide-react';
import { LeadAssignment } from '@/types';
import { LeadDetailView } from './LeadDetailView';
import { AddLeadForm } from './AddLeadForm';
import { BulkImportLeads } from './BulkImportLeads';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

// Status colors for badge + left border
const STATUS_COLORS: Record<string, string> = {
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

// Left border accent color per status
const STATUS_BORDER: Record<string, string> = {
  JOINED_SAMHITHA: 'border-l-emerald-500',
  WILLING_SAMHITHA: 'border-l-emerald-400',
  JOINED_OTHER: 'border-l-slate-400',
  WILLING_DEGREE: 'border-l-sky-400',
  WILLING_OTHER_COLLEGE: 'border-l-amber-400',
  NOT_INTERESTED_SAMHITHA: 'border-l-red-400',
  NOT_INTERESTED_DEGREE: 'border-l-red-400',
  NOT_DECIDED: 'border-l-slate-300',
  WAITING_EAMCET: 'border-l-blue-400',
  WAITING_NEET: 'border-l-blue-400',
  PHONE_UNREACHABLE: 'border-l-slate-300',
  NOT_ANSWERING: 'border-l-slate-300',
  REVISIT_NEEDED: 'border-l-orange-400',
};

// Filter chip color for status
const STATUS_CHIP_COLORS: Record<string, string> = {
  JOINED_SAMHITHA: 'bg-emerald-600 text-white',
  WILLING_SAMHITHA: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  JOINED_OTHER: 'bg-slate-100 text-slate-600 border border-slate-200',
  WILLING_DEGREE: 'bg-sky-100 text-sky-600 border border-sky-200',
  WILLING_OTHER_COLLEGE: 'bg-amber-100 text-amber-600 border border-amber-200',
  NOT_INTERESTED_SAMHITHA: 'bg-red-100 text-red-600 border border-red-200',
  NOT_INTERESTED_DEGREE: 'bg-red-100 text-red-600 border border-red-200',
  NOT_DECIDED: 'bg-slate-100 text-slate-500 border border-slate-200',
  WAITING_EAMCET: 'bg-blue-100 text-blue-600 border border-blue-200',
  WAITING_NEET: 'bg-blue-100 text-blue-600 border border-blue-200',
  PHONE_UNREACHABLE: 'bg-slate-100 text-slate-500 border border-slate-200',
  NOT_ANSWERING: 'bg-slate-100 text-slate-500 border border-slate-200',
  REVISIT_NEEDED: 'bg-orange-100 text-orange-600 border border-orange-200',
};

// Human-readable status labels
const STATUS_LABELS: Record<string, string> = {
  JOINED_SAMHITHA: 'Joined',
  WILLING_SAMHITHA: 'Willing',
  JOINED_OTHER: 'Joined Other',
  WILLING_DEGREE: 'Willing Degree',
  WILLING_OTHER_COLLEGE: 'Willing Other',
  NOT_INTERESTED_SAMHITHA: 'Not Interested',
  NOT_INTERESTED_DEGREE: 'Not Interested',
  NOT_DECIDED: 'Not Decided',
  WAITING_EAMCET: 'Waiting EAMCET',
  WAITING_NEET: 'Waiting NEET',
  PHONE_UNREACHABLE: 'Unreachable',
  NOT_ANSWERING: 'Not Answering',
  REVISIT_NEEDED: 'Revisit',
};

function isOverdue(nextFollowupAt?: Timestamp | any): boolean {
  if (!nextFollowupAt) return false;
  try {
    const date = nextFollowupAt.toDate?.() || nextFollowupAt;
    return date < new Date();
  } catch {
    return false;
  }
}

function formatFollowupDate(nextFollowupAt?: Timestamp | any): string {
  if (!nextFollowupAt) return '';
  try {
    const date = nextFollowupAt.toDate?.() || nextFollowupAt;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function LeadsListView() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadAssignment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) return;
    const q = query(
      collection(db, 'leadAssignments'),
      where('tenantId', '==', user.tenantId),
      where('active', '==', true)
    );
    const unsubscribe: Unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeadAssignment)));
      setLoading(false);
    }, (error) => {
      console.warn('Snapshot listener error:', error.code || error.message);
      setLeads([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(lead => {
        const searchStr = `${lead.parentName || ''} ${lead.studentName || ''} ${lead.uniqueLeadId || ''} ${lead.parentPhone || ''} ${lead.studentPhone || ''} ${lead.divisionName || ''}`;
        return searchStr.toLowerCase().includes(q);
      });
    }
    if (divisionFilter !== 'all') result = result.filter(l => l.divisionId === divisionFilter);
    if (statusFilter !== 'all') result = result.filter(l => l.lastStatusCode === statusFilter);
    return result;
  }, [leads, searchQuery, divisionFilter, statusFilter]);

  const divisions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach(l => { if (l.divisionId) map.set(l.divisionId, l.divisionName || l.divisionId); });
    return Array.from(map.entries());
  }, [leads]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.lastStatusCode) set.add(l.lastStatusCode); });
    return Array.from(set).sort();
  }, [leads]);

  const formatPhone = (phone?: string) => phone?.replace(/(\d{5})(\d{5})/, '$1 $2') || '';

  const isFiltering = searchQuery.trim() || divisionFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDivisionFilter('all');
    setStatusFilter('all');
  }, []);

  // Count by status for chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      if (l.lastStatusCode) {
        counts[l.lastStatusCode] = (counts[l.lastStatusCode] || 0) + 1;
      }
    });
    return counts;
  }, [leads]);

  // Count by division for chips
  const divisionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      if (l.divisionId) {
        counts[l.divisionId] = (counts[l.divisionId] || 0) + 1;
      }
    });
    return counts;
  }, [leads]);

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-3 border-b bg-white"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
            <Input
              placeholder="Search by name, ID, phone, area..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 rounded-full border-emerald-100 focus:border-emerald-400 focus:ring-emerald-400/20 transition-all bg-slate-50/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="h-3 w-3 text-slate-500" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)} className="bg-emerald-600 hover:bg-emerald-700 h-9 w-9 p-0 rounded-full shadow-sm">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9 px-3 rounded-full">
            <FileUp className="h-4 w-4 mr-1" /> Import
          </Button>
        </div>
      </motion.div>

      {/* Filter Chips - Status */}
      <div className="border-b bg-white">
        <div className="px-4 py-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {statuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : STATUS_CHIP_COLORS[s] || 'bg-slate-100 text-slate-500'
                }`}
              >
                {STATUS_LABELS[s] || s}
                <span className="ml-1 opacity-70">{statusCounts[s] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Chips - Area */}
      {divisions.length > 1 && (
        <div className="border-b bg-white">
          <div className="px-4 py-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Area</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setDivisionFilter('all')}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  divisionFilter === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                All Areas
              </button>
              {divisions.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setDivisionFilter(divisionFilter === id ? 'all' : id)}
                  className={`shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    divisionFilter === id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <MapPin className="h-3 w-3" />
                  {name}
                  <span className="opacity-70">{divisionCounts[id] || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lead Count Banner */}
      <div className="px-4 py-2 bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-800">
            {filteredLeads.length}
            <span className="text-slate-400 font-normal"> of {leads.length} leads</span>
          </span>
        </div>
        {isFiltering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
          >
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Lead Cards List */}
      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-16"
            >
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-slate-400">Loading leads...</p>
              </div>
            </motion.div>
          ) : filteredLeads.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-16 text-slate-400"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <Search className="h-16 w-16 mb-3 opacity-20" />
              </motion.div>
              <p className="text-base font-medium text-slate-500 mb-1">No leads found</p>
              <p className="text-xs text-slate-400 mb-4">Try adjusting your search or filters</p>
              {isFiltering && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                >
                  <X className="h-3 w-3 mr-1" /> Clear All Filters
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={container}
              initial="hidden"
              animate="show"
              className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
            >
              {filteredLeads.map(lead => {
                const borderClass = STATUS_BORDER[lead.lastStatusCode || ''] || 'border-l-slate-300';
                const overdue = isOverdue(lead.nextFollowupAt);
                const isJoined = lead.lastStatusCode?.toUpperCase().includes('JOINED');

                return (
                  <motion.div
                    key={lead.id}
                    variants={item}
                    whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    className="cursor-pointer h-full"
                    onClick={() => setSelectedLeadId(lead.leadId)}
                  >
                    <Card className={`border-l-4 ${borderClass} h-full shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col rounded-xl ${isJoined ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100/60'}`}>
                      <CardContent className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Student name prominently, parent as secondary */}
                          <div className="flex items-start justify-between gap-2">
                            <div className={isJoined ? "flex-1 min-w-0 opacity-90" : "flex-1 min-w-0"}>
                              <div className="flex items-center gap-2">
                                <p className={`text-sm md:text-base font-bold leading-tight truncate ${isJoined ? 'text-emerald-900' : 'text-slate-800'}`}>
                                  {lead.studentName}
                                </p>
                                {isJoined && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-slate-500">
                                <Users className="h-3 w-3 shrink-0" />
                                <p className="text-xs font-medium truncate">{lead.parentName}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                               <Badge className="font-mono text-[9px] md:text-[10px] bg-slate-100 text-slate-500 border-0 hover:bg-slate-200 uppercase tracking-wider">
                                 {lead.uniqueLeadId}
                               </Badge>
                                 <div className="flex items-center gap-1">
                                   {lead.lastApproachType && (
                                     <Badge className="text-[9px] border font-medium px-1.5 py-0 bg-slate-50 text-slate-500 border-slate-200">
                                       {lead.lastApproachType}
                                     </Badge>
                                   )}
                                   {lead.lastStatusCode && (
                                     <Badge className={`text-[10px] border font-semibold ${STATUS_COLORS[lead.lastStatusCode] || 'border-slate-200 text-slate-600'}`}>
                                       {lead.lastStatusLabel || STATUS_LABELS[lead.lastStatusCode] || lead.lastStatusCode}
                                     </Badge>
                                   )}
                                 </div>
                            </div>
                          </div>

                          {/* Area badge + Phone + Follow-up */}
                          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
                            {lead.divisionName && (
                              <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50/50 h-6">
                                <MapPin className="h-3 w-3 mr-1" /> {lead.divisionName}
                              </Badge>
                            )}
                            {lead.parentPhone && (
                              <a
                                href={`tel:${lead.parentPhone}`}
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-medium text-slate-600 hover:text-emerald-700 transition-colors bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full"
                              >
                                <PhoneCall className="h-3 w-3 text-sky-500" />
                                {formatPhone(lead.parentPhone)}
                              </a>
                            )}
                            
                            {isJoined && lead.joinedCollegeName && (
                              <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-100 h-6 shadow-sm font-bold uppercase tracking-wider">
                                <GraduationCap className="h-3 w-3 mr-1 text-emerald-600" /> {lead.joinedCollegeName}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Follow-up date */}
                        {lead.nextFollowupAt && !isJoined && (
                          <div className={`mt-4 pt-3 border-t border-slate-50 flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="font-semibold">{formatFollowupDate(lead.nextFollowupAt)}</span>
                            {overdue && (
                              <Badge variant="outline" className="ml-auto inline-flex items-center gap-1 text-[9px] border-red-200 bg-red-50 text-red-600 font-bold uppercase tracking-wider rounded-md px-1.5 py-0">
                                <AlertCircle className="h-3 w-3" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {selectedLeadId && <LeadDetailView leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
      {showAddForm && <AddLeadForm onClose={() => setShowAddForm(false)} />}
      {showImport && <BulkImportLeads onClose={() => setShowImport(false)} />}
    </div>
  );
}
