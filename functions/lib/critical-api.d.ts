/**
 * Single Gen2 Cloud Function that routes to the correct handler.
 *
 * Client protocol:
 *   httpsCallable(functions, 'criticalApi')({ action: 'createLead', payload: {...} })
 *
 * The router extracts `action` and `payload`, then dispatches to the handler.
 * Auth context is forwarded as-is from the onCall request.
 */
export declare const criticalApi: import("firebase-functions/v2/https").CallableFunction<any, Promise<any>, unknown>;
