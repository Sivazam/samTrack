export declare function registerFcmTokenHandler(payload: any, request: any): Promise<{
    success: boolean;
}>;
export declare function unregisterFcmTokenHandler(payload: any, request: any): Promise<{
    success: boolean;
}>;
export declare function markNotificationReadHandler(payload: any, request: any): Promise<{
    success: boolean;
}>;
export declare function sendStatusUpdateNotificationHandler(payload: any, request: any): Promise<{
    success: boolean;
    notifiedCount: number;
}>;
export declare function sendReminderPushHandler(payload: any, request: any): Promise<{
    success: boolean;
}>;
