/**
 * Firestore Service — Samhitha Admissions Tracker
 * Client-side service for Firestore CRUD operations.
 * All writes go through Cloud Functions for security.
 * This service is for READ operations and onSnapshot listeners.
 */

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, onSnapshot,
  query, where, orderBy, limit, Timestamp, Unsubscribe,
} from 'firebase/firestore';
import type {
  Tenant, User, Division, Team, Lead, StatusUpdate,
  LeadAssignment, Reminder, TenantConfig, ImportBatch,
  TenantStats, TenantDailyStats,
} from '@/types';

// ─── Tenant Service ─────────────────────────────────────────────
export const tenantService = {
  getById: async (tenantId: string): Promise<Tenant | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.TENANTS, tenantId));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Tenant : null;
  },
  getAll: async (): Promise<Tenant[]> => {
    const snap = await getDocs(collection(db, COLLECTIONS.TENANTS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));
  },
  onSnapshot: (callback: (tenants: Tenant[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, COLLECTIONS.TENANTS), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
    });
  },
};

// ─── User Service ───────────────────────────────────────────────
export const userService = {
  getById: async (uid: string): Promise<User | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } as User : null;
  },
  getByTenant: async (tenantId: string): Promise<User[]> => {
    const q = query(collection(db, COLLECTIONS.USERS), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
  },
  onSnapshotByTenant: (tenantId: string, callback: (users: User[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.USERS), where('tenantId', '==', tenantId));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
  },
};

// ─── Division Service ───────────────────────────────────────────
export const divisionService = {
  getByTenant: async (tenantId: string): Promise<Division[]> => {
    const q = query(collection(db, COLLECTIONS.DIVISIONS), where('tenantId', '==', tenantId), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Division));
  },
  onSnapshotByTenant: (tenantId: string, callback: (divisions: Division[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.DIVISIONS), where('tenantId', '==', tenantId), where('active', '==', true));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Division)));
    });
  },
};

// ─── Team Service ───────────────────────────────────────────────
export const teamService = {
  getByTenant: async (tenantId: string): Promise<Team[]> => {
    const q = query(collection(db, COLLECTIONS.TEAMS), where('tenantId', '==', tenantId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
  },
  onSnapshotByTenant: (tenantId: string, callback: (teams: Team[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.TEAMS), where('tenantId', '==', tenantId));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });
  },
};

// ─── Lead Service ───────────────────────────────────────────────
export const leadService = {
  getById: async (leadId: string): Promise<Lead | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.LEADS, leadId));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Lead : null;
  },
  getStatusUpdates: async (leadId: string): Promise<StatusUpdate[]> => {
    const q = query(collection(db, COLLECTIONS.LEADS, leadId, COLLECTIONS.STATUS_UPDATES), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StatusUpdate));
  },
  onSnapshot: (leadId: string, callback: (lead: Lead | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.LEADS, leadId), snap => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } as Lead : null);
    });
  },
  onStatusUpdates: (leadId: string, callback: (updates: StatusUpdate[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.LEADS, leadId, COLLECTIONS.STATUS_UPDATES), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as StatusUpdate)));
    });
  },
};

// ─── Lead Assignment Service ────────────────────────────────────
export const leadAssignmentService = {
  getByTenant: async (tenantId: string): Promise<LeadAssignment[]> => {
    const q = query(collection(db, COLLECTIONS.LEAD_ASSIGNMENTS), where('tenantId', '==', tenantId), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LeadAssignment));
  },
  onSnapshotByPRO: (tenantId: string, proUid: string, callback: (assignments: LeadAssignment[]) => void): Unsubscribe => {
    const q = query(
      collection(db, COLLECTIONS.LEAD_ASSIGNMENTS),
      where('tenantId', '==', tenantId),
      where('assignedPROUids', 'array-contains', proUid),
      where('active', '==', true),
    );
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeadAssignment)));
    });
  },
  onSnapshotByTenant: (tenantId: string, callback: (assignments: LeadAssignment[]) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.LEAD_ASSIGNMENTS), where('tenantId', '==', tenantId), where('active', '==', true));
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeadAssignment)));
    });
  },
};

// ─── Reminder Service ───────────────────────────────────────────
export const reminderService = {
  getByLead: async (leadId: string): Promise<Reminder[]> => {
    const q = query(collection(db, COLLECTIONS.REMINDERS), where('leadId', '==', leadId), orderBy('dueAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder));
  },
  onSnapshotByRecipient: (uid: string, callback: (reminders: Reminder[]) => void): Unsubscribe => {
    const q = query(
      collection(db, COLLECTIONS.REMINDERS),
      where('recipientUids', 'array-contains', uid),
      where('status', 'in', ['PENDING', 'SNOOZED']),
      orderBy('dueAt', 'asc'),
    );
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Reminder)));
    });
  },
};

// ─── Tenant Config Service ──────────────────────────────────────
export const tenantConfigService = {
  get: async (tenantId: string): Promise<TenantConfig | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.TENANT_CONFIG, tenantId));
    return snap.exists() ? snap.data() as TenantConfig : null;
  },
  onSnapshot: (tenantId: string, callback: (config: TenantConfig | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.TENANT_CONFIG, tenantId), snap => {
      callback(snap.exists() ? snap.data() as TenantConfig : null);
    });
  },
};

// ─── Tenant Stats Service ───────────────────────────────────────
export const tenantStatsService = {
  get: async (tenantId: string): Promise<TenantStats | null> => {
    const snap = await getDoc(doc(db, COLLECTIONS.TENANT_STATS, tenantId));
    return snap.exists() ? snap.data() as TenantStats : null;
  },
  onSnapshot: (tenantId: string, callback: (stats: TenantStats | null) => void): Unsubscribe => {
    return onSnapshot(doc(db, COLLECTIONS.TENANT_STATS, tenantId), snap => {
      callback(snap.exists() ? snap.data() as TenantStats : null);
    });
  },
};

// ─── Import Batch Service ───────────────────────────────────────
export const importBatchService = {
  getByTenant: async (tenantId: string): Promise<ImportBatch[]> => {
    const q = query(collection(db, COLLECTIONS.IMPORT_BATCHES), where('tenantId', '==', tenantId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportBatch));
  },
};

// Re-export Timestamp for convenience
export { Timestamp };
