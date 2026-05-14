import * as admin from 'firebase-admin';
import type { CallableRequest } from 'firebase-functions/v2/https';
export declare function createUserHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    uid: string;
}>;
export declare function updateUserHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
}>;
export declare function deactivateUserHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
}>;
export declare function manageTeamHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    teamId: string;
    clearedAssignments?: undefined;
} | {
    success: boolean;
    teamId?: undefined;
    clearedAssignments?: undefined;
} | {
    success: boolean;
    clearedAssignments: number;
    teamId?: undefined;
}>;
export declare function createLeadHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    leadId: string;
}>;
export declare function bulkCreateLeadsHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    batchId: string;
    successCount: number;
    errorCount: number;
    errors: {
        row: number;
        uniqueLeadId?: string;
        reason: string;
    }[];
}>;
export declare function updateLeadHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
}>;
export declare function reassignLeadTeamHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
}>;
export declare function bulkReassignLeadsHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    reassigned: any;
}>;
export declare function syncLeadAssignmentsHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    synced: number;
    commits: number;
}>;
export declare function logStatusUpdateHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    updateId: string;
}>;
export declare function manageReminderHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    reminderId: string;
} | {
    success: boolean;
    reminderId?: undefined;
}>;
export declare function updateTenantConfigHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
}>;
export declare function generateReportHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    type: any;
    totalUpdates: number;
    byPRO: Record<string, number>;
    byTeam: Record<string, number>;
    byApproach: Record<string, number>;
    stats?: undefined;
    count?: undefined;
    reminders?: undefined;
    divisions?: undefined;
} | {
    success: boolean;
    type: any;
    stats: admin.firestore.DocumentData | undefined;
    totalUpdates?: undefined;
    byPRO?: undefined;
    byTeam?: undefined;
    byApproach?: undefined;
    count?: undefined;
    reminders?: undefined;
    divisions?: undefined;
} | {
    success: boolean;
    type: any;
    count: number;
    reminders: {
        id: string;
    }[];
    totalUpdates?: undefined;
    byPRO?: undefined;
    byTeam?: undefined;
    byApproach?: undefined;
    stats?: undefined;
    divisions?: undefined;
} | {
    success: boolean;
    type: any;
    divisions: {
        id: string;
        name: any;
        code: any;
        leadCount: number;
    }[];
    totalUpdates?: undefined;
    byPRO?: undefined;
    byTeam?: undefined;
    byApproach?: undefined;
    stats?: undefined;
    count?: undefined;
    reminders?: undefined;
}>;
export declare function getDashboardStatsHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    stats: admin.firestore.DocumentData | undefined;
}>;
export declare function adminCreateTenantHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    tenantId: string;
    adminUid: string;
}>;
export declare function adminUpdateTenantHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
}>;
export declare function syncClaimsHandler(payload: any, request: CallableRequest): Promise<{
    success: boolean;
    claims: Record<string, any>;
}>;
