/**
 * Cloud Functions Client Service — Samhitha Admissions Tracker
 * Uses Firebase SDK httpsCallable for secure, authenticated calls
 * Routes actions through criticalApi / notificationApi onCall routers
 */

import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import app from '@/lib/firebase';

// Initialize Firebase Functions instance (lazy singleton)
let functionsInstance: ReturnType<typeof getFunctions> | null = null;
function getFirebaseFunctions() {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, 'asia-south1');
  }
  return functionsInstance;
}

interface CloudFunctionResponse<T = any> {
  success?: boolean;
  error?: string;
  data?: T;
}

// ===== onCall Router Sets =====
// Critical functions → bundled into criticalApi (Gen2)
const CRITICAL_ACTIONS = new Set([
  'createUser', 'updateUser', 'deactivateUser', 'manageTeam',
  'createLead', 'bulkCreateLeads', 'updateLead', 'reassignLeadTeam', 'bulkReassignLeads',
  'syncLeadAssignments', 'logStatusUpdate', 'manageReminder',
  'updateTenantConfig', 'generateReport', 'getDashboardStats',
  // Super Admin
  'adminCreateTenant', 'adminUpdateTenant',
  // Claims sync
  'syncClaims',
]);

// Notification functions → bundled into notificationApi (Gen2)
const NOTIFICATION_ACTIONS = new Set([
  'registerFcmToken', 'unregisterFcmToken', 'markNotificationRead',
  'sendStatusUpdateNotification', 'sendReminderPush',
]);

/**
 * Core function to call Firebase Cloud Function via SDK httpsCallable
 */
async function callCloudFunction<T = any>(
  actionName: string,
  data: any
): Promise<T> {
  try {
    const functions = getFirebaseFunctions();

    let actualFunction = actionName;
    let actualData = data;

    if (CRITICAL_ACTIONS.has(actionName)) {
      actualFunction = 'criticalApi';
      actualData = { action: actionName, payload: data };
    } else if (NOTIFICATION_ACTIONS.has(actionName)) {
      actualFunction = 'notificationApi';
      actualData = { action: actionName, payload: data };
    }

    const callable = httpsCallable<any, T>(functions, actualFunction);
    const result: HttpsCallableResult<T> = await callable(actualData);
    return result.data;
  } catch (error: any) {
    console.error(`Error calling cloud function ${actionName}:`, {
      code: error?.code,
      message: error?.message,
      details: error?.details
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function createUserViaCloudFunction(data: {
  email: string;
  username: string;
  password: string;
  displayName: string;
  role: string;
  teamId?: string;
  assignedDivisionIds?: string[];
  phone?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('createUser', data);
}

export async function updateUserViaCloudFunction(data: {
  userId: string;
  displayName?: string;
  phone?: string;
  role?: string;
  teamId?: string;
  assignedDivisionIds?: string[];
  active?: boolean;
  username?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('updateUser', data);
}

export async function deactivateUserViaCloudFunction(data: {
  userId: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('deactivateUser', data);
}

// ═══════════════════════════════════════════════════════════════
// TEAM MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function manageTeamViaCloudFunction(data: {
  subAction: 'create' | 'update' | 'dissolve';
  teamId?: string;
  name?: string;
  memberUids?: string[];
  divisionIds?: string[];
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('manageTeam', data);
}

// ═══════════════════════════════════════════════════════════════
// LEAD MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function createLeadViaCloudFunction(data: {
  uniqueLeadId: string;
  parentName: string;
  studentName: string;
  parentPhone?: string;
  studentPhone?: string;
  intermediateGroup?: string;
  address?: string;
  divisionId: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('createLead', data);
}

export async function bulkCreateLeadsViaCloudFunction(data: {
  rows: any[];
  sourceFilename: string;
  cityFromFilename?: string;
  mode?: 'skip' | 'error';
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('bulkCreateLeads', data);
}

export async function updateLeadViaCloudFunction(data: {
  leadId: string;
  parentName?: string;
  studentName?: string;
  parentPhone?: string;
  studentPhone?: string;
  intermediateGroup?: string;
  address?: string;
  divisionId?: string;
  active?: boolean;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('updateLead', data);
}

export async function reassignLeadTeamViaCloudFunction(data: {
  leadId: string;
  toTeamId: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('reassignLeadTeam', data);
}

export async function bulkReassignLeadsViaCloudFunction(data: {
  divisionId?: string;
  fromTeamId?: string;
  toTeamId: string;
  leadIds?: string[];
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('bulkReassignLeads', data);
}

export async function syncLeadAssignmentsViaCloudFunction(data: {
  tenantId: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('syncLeadAssignments', data);
}

// ═══════════════════════════════════════════════════════════════
// STATUS UPDATES
// ═══════════════════════════════════════════════════════════════

export async function logStatusUpdateViaCloudFunction(data: {
  leadId: string;
  approachType: string;
  statusCode: string;
  comments?: string;
  parentPhone?: string;
  studentPhone?: string;
  intermediateGroup?: string;
  joinedCollegeName?: string;
  accompanyingMemberUid?: string;
  gpsLocation?: { lat: number; lng: number; accuracyMeters: number; capturedAt: any };
  gpsRequired: boolean;
  gpsCaptured: boolean;
  nextFollowupAt?: any;
  nextFollowupNote?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('logStatusUpdate', data);
}

// ═══════════════════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════════════════

export async function manageReminderViaCloudFunction(data: {
  subAction: 'create' | 'update' | 'snooze' | 'complete' | 'cancel';
  reminderId?: string;
  leadId?: string;
  dueAt?: any;
  dueDateOnly?: boolean;
  note?: string;
  snoozeDuration?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('manageReminder', data);
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

export async function updateTenantConfigViaCloudFunction(data: {
  statusOptions?: any[];
  intermediateGroups?: any[];
  joinedCollegeOptions?: any[];
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('updateTenantConfig', data);
}

// ═══════════════════════════════════════════════════════════════
// REPORTS & DASHBOARD
// ═══════════════════════════════════════════════════════════════

export async function generateReportViaCloudFunction(data: {
  type: 'daily_activity' | 'status_funnel' | 'overdue_followups' | 'division_summary';
  startDate?: string;
  endDate?: string;
  divisionId?: string;
  teamId?: string;
  proUid?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('generateReport', data);
}

export async function getDashboardStatsViaCloudFunction(): Promise<CloudFunctionResponse> {
  return callCloudFunction('getDashboardStats', {});
}

// ═══════════════════════════════════════════════════════════════
// TENANT MANAGEMENT (Super Admin)
// ═══════════════════════════════════════════════════════════════

export async function adminCreateTenantViaCloudFunction(data: {
  name: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName?: string;
  adminUsername?: string;
  adminPhone?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('adminCreateTenant', data);
}

export async function adminUpdateTenantViaCloudFunction(data: {
  tenantId: string;
  updateData: any;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('adminUpdateTenant', data);
}

// ═══════════════════════════════════════════════════════════════
// FCM / NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

export async function registerFcmTokenViaCloudFunction(data: {
  token: string;
  deviceId: string;
  userAgent: string;
  machineId?: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('registerFcmToken', data);
}

export async function unregisterFcmTokenViaCloudFunction(data: {
  token: string;
  deviceId: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('unregisterFcmToken', data);
}

export async function markNotificationReadViaCloudFunction(data: {
  notificationId: string;
}): Promise<CloudFunctionResponse> {
  return callCloudFunction('markNotificationRead', data);
}

/**
 * Check if Cloud Functions are available
 */
export function areCloudFunctionsAvailable(): boolean {
  return true;
}

/**
 * Sync custom claims via Cloud Function
 */
export async function syncClaimsViaCloudFunction(): Promise<CloudFunctionResponse> {
  return callCloudFunction('syncClaims', {});
}
