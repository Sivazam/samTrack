import { Timestamp } from 'firebase/firestore';
import { ROLES, TENANT_STATUSES, APPROACH_TYPES } from '@/lib/firebase';

// FCM Device interface
export interface FCMDevice {
  token: string;
  deviceId: string;
  userAgent: string;
  lastActive: Timestamp | Date | any;
  createdAt: Timestamp | Date | any;
  isActive: boolean;
  machineId?: string;
}

// Base interface with common fields
export interface BaseDocument {
  id: string;
  tenantId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid?: string;
}

// ===== ROLES =====
export type Role = 'SUPER_ADMIN' | 'COLLEGE_ADMIN' | 'MANAGER' | 'PRO';

// ===== APPROACH TYPES =====
export type ApproachType = 'PHONE' | 'DOORSTEP' | 'WALK_IN' | 'ONLINE';

// ===== Tenant (College) =====
export interface Tenant extends BaseDocument {
  name: string;
  type: 'COLLEGE';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
  fcmDevices?: FCMDevice[];
}

// ===== Area (stored as 'divisions' collection in Firestore) =====
export interface Area extends BaseDocument {
  name: string;
  code: string;  // e.g., "RJY" - short code, unique per tenant
  description?: string;
  active: boolean;
}

// Backward-compatible alias
export type Division = Area;

// ===== Team =====
export interface Team extends BaseDocument {
  name: string;  // e.g., "Team RJY-1"
  memberUids: string[];  // 1 or 2 UIDs
  divisionIds: string[];
  active: boolean;
}

// ===== User =====
export interface User extends BaseDocument {
  email: string;
  username: string;  // lowercase, unique per tenant
  displayName: string;
  phone?: string;  // optional, for contact only, NOT auth
  role: Role;
  teamId?: string;  // PRO only
  assignedDivisionIds?: string[];  // PRO/MANAGER for filtering
  active: boolean;
  fcmDevices?: FCMDevice[];
}

// ===== Username Index =====
export interface UsernameIndex {
  uid: string;
  email: string;
  tenantId: string;
  createdAt: Timestamp;
}

// ===== Lead (replaces Retailer) =====
export interface Lead extends BaseDocument {
  uniqueLeadId: number;  // admin-supplied; UNIQUE per tenant (positive integer)

  parentName: string;
  parentName_lowercase: string;
  studentName: string;
  studentName_lowercase: string;

  parentPhone?: string;  // normalized 10-digit
  studentPhone?: string;  // normalized 10-digit

  intermediateGroup?: string;  // code from tenantConfig
  address?: string;
  divisionId: string;
  divisionName: string;  // denorm
  sourceCity?: string;
  sourceImportBatchId?: string;

  teamId?: string;
  assignedPROUids: string[];  // denorm from team.memberUids

  // Latest status snapshot (denorm from latest statusUpdate)
  lastStatusCode?: string;
  lastStatusLabel?: string;
  lastStatusAt?: Timestamp;
  lastApproachType?: ApproachType;
  lastUpdatedByUid?: string;
  lastUpdatedByTeamId?: string;

  // Latest pending follow-up (denorm)
  nextFollowupAt?: Timestamp;
  nextFollowupReminderId?: string;

  joinedCollegeName?: string;

  isReferral?: boolean;  // PRO-created referral lead

  active: boolean;  // soft-delete flag
}

// ===== Status Update (subcollection of Lead) =====
export interface StatusUpdate extends BaseDocument {
  leadId: string;
  approachType: ApproachType;
  statusCode: string;
  statusLabel: string;  // denorm at write time
  parentPhone?: string;
  studentPhone?: string;
  intermediateGroup?: string;
  joinedCollegeName?: string;
  comments?: string;  // max 2000 chars
  loggedByUid: string;
  loggedByName: string;  // denorm
  accompanyingMemberUid?: string;  // teammate
  accompanyingMemberName?: string;
  teamId?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
    accuracyMeters: number;
    capturedAt: Timestamp;
  };
  gpsRequired: boolean;
  gpsCaptured: boolean;
  nextFollowupReminderId?: string;
  createdAt: Timestamp;
}

// ===== Lead Assignment (denorm for search) =====
export interface LeadAssignment extends BaseDocument {
  leadId: string;
  teamId?: string;
  assignedPROUids: string[];
  divisionId: string;
  divisionName: string;
  // search fields:
  parentName: string;
  parentName_lowercase: string;
  studentName: string;
  studentName_lowercase: string;
  uniqueLeadId: number;
  parentPhone?: string;
  studentPhone?: string;
  // status snapshot for filter:
  lastStatusCode?: string;
  lastStatusLabel?: string;
  lastApproachType?: string;
  joinedCollegeName?: string;
  nextFollowupAt?: Timestamp;
  isReferral?: boolean;
  active: boolean;
}

// ===== Reminder =====
export type ReminderStatus = 'PENDING' | 'SENT' | 'COMPLETED' | 'SNOOZED' | 'CANCELLED';

export interface Reminder extends BaseDocument {
  leadId: string;
  leadDisplayName: string;  // denorm "ParentName / StudentName"
  uniqueLeadId: number;  // denorm
  dueAt: Timestamp;
  dueDateOnly: boolean;
  note?: string;
  createdByName: string;
  recipientUids: string[];
  status: ReminderStatus;
  snoozedFromReminderId?: string;
  sentAt?: Timestamp;
  completedAt?: Timestamp;
  completedByUid?: string;
}

// ===== Tenant Config =====
export interface StatusOption {
  code: string;
  label: string;
  color: string;
  isTerminal: boolean;
  order: number;
  active: boolean;
  autoReminderDate?: string;   // YYYY-MM-DD — result/event date for auto-reminder
  autoReminderOffset?: number; // days offset from autoReminderDate (0 = same day)
}

export interface IntermediateGroup {
  code: string;
  label: string;
  order: number;
  active: boolean;
}

export interface JoinedCollegeOption {
  code: string;
  label: string;
  order: number;
  active: boolean;
}

export interface TenantConfig {
  tenantId: string;
  statusOptions: StatusOption[];
  intermediateGroups: IntermediateGroup[];
  joinedCollegeOptions: JoinedCollegeOption[];
  updatedAt: Timestamp;
  updatedByUid?: string;
}

// ===== Import Batch =====
export interface ImportBatch extends BaseDocument {
  sourceFilename: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: Array<{ row: number; uniqueLeadId?: number; reason: string }>;
  cityFromFilename?: string;
  completedAt?: Timestamp;
}

// ===== Tenant Stats =====
export interface TenantStats {
  tenantId: string;
  totalLeads: number;
  totalActiveLeads: number;
  byStatusCounts: Record<string, number>;
  followupsDueToday: number;
  joinedSamhithaCount: number;
  joinedOtherCount: number;
  updatedAt: Timestamp;
}

// ===== Tenant Daily Stats =====
export interface TenantDailyStats {
  tenantId: string;
  date: string;  // YYYY-MM-DD IST
  updatesCount: number;
  byApproachType: {
    PHONE: number;
    DOORSTEP: number;
    WALK_IN: number;
    ONLINE: number;
  };
  byPROUid: Record<string, number>;
  byTeamId: Record<string, number>;
  remindersFired: number;
  remindersCompleted: number;
  updatedAt: Timestamp;
}

// ===== GPS Location =====
export interface GpsLocation {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: Date;
  accuracyWarning?: string;
}

// ===== Auth Context Types =====
export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  tenantId?: string;
  tenantStatus?: string;
  role?: Role;
  teamId?: string;
  assignedDivisionIds?: string[];
  username?: string;
  phone?: string;
  tenantName?: string;
  tenantBranding?: { logoUrl?: string; primaryColor?: string };
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loadingProgress?: number;
  loadingStage?: string;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  hasRole: (role: Role) => boolean;
  isAdminOrManager: () => boolean;
  isPRO: () => boolean;
  isSuperAdmin: () => boolean;
}

// ===== API Response Types =====
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== Form Types =====
export interface CreateUserForm {
  email: string;
  username: string;
  password: string;
  displayName: string;
  role: Role;
  teamId?: string;
  assignedDivisionIds?: string[];
  phone?: string;
}

export interface CreateLeadForm {
  uniqueLeadId: string;
  parentName: string;
  studentName: string;
  parentPhone?: string;
  studentPhone?: string;
  intermediateGroup?: string;
  address?: string;
  divisionId: string;
}

export interface LogStatusUpdateForm {
  leadId: string;
  approachType: ApproachType;
  statusCode: string;
  comments?: string;
  parentPhone?: string;
  studentPhone?: string;
  intermediateGroup?: string;
  joinedCollegeName?: string;
  accompanyingMemberUid?: string;
  gpsLocation?: GpsLocation;
  nextFollowupAt?: Date;
  nextFollowupNote?: string;
}

export interface CreateTeamForm {
  name: string;
  memberUids: string[];
  divisionIds: string[];
}

export interface CreateAreaForm {
  name: string;
  code: string;
  description?: string;
}

// Backward-compatible alias
export type CreateDivisionForm = CreateAreaForm;

export interface CreateReminderForm {
  leadId: string;
  dueAt: Date;
  dueDateOnly: boolean;
  note?: string;
}

// ===== Dashboard Stats =====
export interface DashboardStats {
  totalLeads: number;
  totalActiveLeads: number;
  byStatusCounts: Record<string, number>;
  followupsDueToday: number;
  joinedSamhithaCount: number;
  joinedOtherCount: number;
  todayUpdatesCount: number;
  topPROs: Array<{
    id: string;
    name: string;
    updatesCount: number;
  }>;
  recentUpdates: StatusUpdate[];
}

// ===== Super Admin Analytics =====
export interface CollegeStats {
  tenantId: string;
  tenantName: string;
  totalLeads: number;
  activeLeads: number;
  joinedSamhithaCount: number;
  proCount: number;
  userCount: number;
  activeUserCount: number;
}

