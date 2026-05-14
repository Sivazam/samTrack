import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
export declare function verifyAuthToken(context: functions.https.CallableContext): Promise<admin.auth.DecodedIdToken>;
export declare function requireSuperAdmin(token: admin.auth.DecodedIdToken): void;
export declare function requireAdminOrManager(token: admin.auth.DecodedIdToken): void;
export declare function requirePROOrAbove(token: admin.auth.DecodedIdToken): void;
export declare function isAdminOrManager(role?: string): boolean;
/**
 * Normalizes an Indian phone number to 10 digits.
 * Strips country code "91" prefix, invisible Unicode chars, non-digits.
 * Returns empty string if result is not 10 digits.
 */
export declare function cleanPhoneStr(phone?: string | null): string;
export declare function checkRateLimit(db: admin.firestore.Firestore, key: string, maxPerMinute?: number): Promise<void>;
export declare function isAlreadyProcessed(db: admin.firestore.Firestore, eventId: string): Promise<boolean>;
/**
 * Writes an array of Firestore operations in batches of `batchSize`.
 * Returns the total number of commits made.
 */
export declare function commitInChunks(db: admin.firestore.Firestore, operations: Array<(batch: admin.firestore.WriteBatch) => void>, batchSize?: number): Promise<number>;
export declare const RESERVED_USERNAMES: Set<string>;
export declare function validateUsername(username: string): string | null;
export declare function validateUniqueLeadId(id: string): string | null;
export declare function buildLeadAssignmentSearchFields(lead: any, division?: any): Record<string, any>;
