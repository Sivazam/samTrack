'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, Unsubscribe } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, MapPin, Calendar, Phone, RefreshCw } from 'lucide-react';
import { LeadAssignment } from '@/types';
import { LeadDetailView } from './LeadDetailView';
import { AddLeadForm } from './AddLeadForm';
import { BulkImportLeads } from './BulkImportLeads';

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

  // Fetch leads
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

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Button size="sm" onClick={() => setShowAddForm(true)}><Plus className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>Import</Button>
        </div>
        <div className="flex gap-2">
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Division" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-1 text-xs text-muted-foreground border-b">
        {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} found
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mb-2 opacity-30" />
            <p className="text-sm">No leads found</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredLeads.map(lead => (
              <div key={lead.id} className="px-4 py-3 hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedLeadId(lead.leadId)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.parentName} / {lead.studentName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{lead.uniqueLeadId}</span>
                      {lead.parentPhone && <><Phone className="h-3 w-3" />{formatPhone(lead.parentPhone)}</>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{lead.divisionName}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {lead.lastStatusCode && <Badge variant="secondary" className="text-xs">{lead.lastStatusCode}</Badge>}
                    {lead.nextFollowupAt && (
                      <Badge variant="outline" className="text-xs"><Calendar className="h-3 w-3 mr-1" />{new Date(lead.nextFollowupAt.toMillis?.() || 0).toLocaleDateString()}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {selectedLeadId && <LeadDetailView leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
      {showAddForm && <AddLeadForm onClose={() => setShowAddForm(false)} />}
      {showImport && <BulkImportLeads onClose={() => setShowImport(false)} />}
    </div>
  );
}
