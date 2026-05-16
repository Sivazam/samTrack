"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criticalApi = void 0;
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
const https_1 = require("firebase-functions/v2/https");
const heavy_apis_1 = require("./heavy-apis");
// Handler registry — maps action names to handler functions
const HANDLERS = {
    // ── User Management ──
    createUser: heavy_apis_1.createUserHandler,
    updateUser: heavy_apis_1.updateUserHandler,
    deactivateUser: heavy_apis_1.deactivateUserHandler,
    // ── Team Management ──
    manageTeam: heavy_apis_1.manageTeamHandler,
    // ── Lead Management ──
    createLead: heavy_apis_1.createLeadHandler,
    createReferralLead: heavy_apis_1.createReferralLeadHandler,
    bulkCreateLeads: heavy_apis_1.bulkCreateLeadsHandler,
    updateLead: heavy_apis_1.updateLeadHandler,
    reassignLeadTeam: heavy_apis_1.reassignLeadTeamHandler,
    bulkReassignLeads: heavy_apis_1.bulkReassignLeadsHandler,
    syncLeadAssignments: heavy_apis_1.syncLeadAssignmentsHandler,
    // ── Status Updates ──
    logStatusUpdate: heavy_apis_1.logStatusUpdateHandler,
    // ── Reminders ──
    manageReminder: heavy_apis_1.manageReminderHandler,
    // ── Config ──
    updateTenantConfig: heavy_apis_1.updateTenantConfigHandler,
    // ── Reports & Dashboard ──
    generateReport: heavy_apis_1.generateReportHandler,
    getDashboardStats: heavy_apis_1.getDashboardStatsHandler,
    // ── Super Admin ──
    adminCreateTenant: heavy_apis_1.adminCreateTenantHandler,
    adminUpdateTenant: heavy_apis_1.adminUpdateTenantHandler,
    syncClaims: heavy_apis_1.syncClaimsHandler,
    // ── Username Resolution (unauthenticated) ──
    resolveUsernameToEmail: heavy_apis_1.resolveUsernameToEmailHandler,
    // ── Admin / Demo Reset ──
    resetTenantData: heavy_apis_1.resetTenantDataHandler,
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
exports.criticalApi = (0, https_1.onCall)({
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 300,
    concurrency: 80,
    minInstances: 0,
}, async (request) => {
    const { action, payload } = request.data || {};
    if (!action || typeof action !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid "action" field. Expected { action: string, payload: any }.');
    }
    const handler = HANDLERS[action];
    if (!handler) {
        throw new https_1.HttpsError('not-found', `Unknown action "${action}". Valid actions: ${Object.keys(HANDLERS).join(', ')}`);
    }
    console.log(`🚀 criticalApi: routing action="${action}"`);
    // Dispatch — pass payload as `data` and the full request as `context`
    // (handlers expect `(data, context)` where context.auth has the user token)
    return handler(payload || {}, request);
});
//# sourceMappingURL=critical-api.js.map