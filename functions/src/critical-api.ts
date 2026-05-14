/**
 * Critical API — Gen2 onCall Router
 * 
 * Bundles all critical/high-traffic Cloud Functions for the
 * Samhitha Admissions Tracker into a SINGLE Gen2 instance.
 * Client sends { action: 'createUser', payload: {...} } and this
 * router dispatches to the correct handler.
 * 
 * Benefits:
 * - Gen2 concurrency: 80 concurrent requests per instance
 * - Eliminates cold starts for lead creation, status updates, reports, etc.
 * - PROs and Admins get instant responses
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    createUserHandler,
    updateUserHandler,
    deactivateUserHandler,
    manageTeamHandler,
    createLeadHandler,
    bulkCreateLeadsHandler,
    updateLeadHandler,
    reassignLeadTeamHandler,
    bulkReassignLeadsHandler,
    syncLeadAssignmentsHandler,
    logStatusUpdateHandler,
    manageReminderHandler,
    updateTenantConfigHandler,
    generateReportHandler,
    getDashboardStatsHandler,
    adminCreateTenantHandler,
    adminUpdateTenantHandler,
    syncClaimsHandler,
} from './heavy-apis';

// Handler registry — maps action names to handler functions
const HANDLERS: Record<string, (data: any, context: any) => Promise<any>> = {
    // ── User Management ──
    createUser: createUserHandler,
    updateUser: updateUserHandler,
    deactivateUser: deactivateUserHandler,
    // ── Team Management ──
    manageTeam: manageTeamHandler,
    // ── Lead Management ──
    createLead: createLeadHandler,
    bulkCreateLeads: bulkCreateLeadsHandler,
    updateLead: updateLeadHandler,
    reassignLeadTeam: reassignLeadTeamHandler,
    bulkReassignLeads: bulkReassignLeadsHandler,
    syncLeadAssignments: syncLeadAssignmentsHandler,
    // ── Status Updates ──
    logStatusUpdate: logStatusUpdateHandler,
    // ── Reminders ──
    manageReminder: manageReminderHandler,
    // ── Config ──
    updateTenantConfig: updateTenantConfigHandler,
    // ── Reports & Dashboard ──
    generateReport: generateReportHandler,
    getDashboardStats: getDashboardStatsHandler,
    // ── Super Admin ──
    adminCreateTenant: adminCreateTenantHandler,
    adminUpdateTenant: adminUpdateTenantHandler,
    syncClaims: syncClaimsHandler,
};

/**
 * Single Gen2 Cloud Function that routes to the correct handler.
 * 
 * Client protocol:
 *   httpsCallable(functions, 'criticalApi')({ action: 'createLead', payload: {...} })
 * 
 * The router extracts `action` and `payload`, then dispatches to the handler.
 * Auth context is forwarded as-is from the onCall request.
 */
export const criticalApi = onCall(
    {
        region: 'asia-south1',
        memory: '512MiB',
        timeoutSeconds: 300,
        concurrency: 80,
        minInstances: 0,
    },
    async (request) => {
        const { action, payload } = request.data || {};

        if (!action || typeof action !== 'string') {
            throw new HttpsError('invalid-argument', 'Missing or invalid "action" field. Expected { action: string, payload: any }.');
        }

        const handler = HANDLERS[action];
        if (!handler) {
            throw new HttpsError(
                'not-found',
                `Unknown action "${action}". Valid actions: ${Object.keys(HANDLERS).join(', ')}`
            );
        }

        console.log(`🚀 criticalApi: routing action="${action}"`);

        // Dispatch — pass payload as `data` and the full request as `context`
        // (handlers expect `(data, context)` where context.auth has the user token)
        return handler(payload || {}, request);
    }
);
