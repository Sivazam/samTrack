"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationApi = void 0;
const https_1 = require("firebase-functions/v2/https");
const notification_handlers_1 = require("./notification-handlers");
exports.notificationApi = (0, https_1.onCall)({
    region: 'asia-south1',
    memory: '256MiB',
    timeoutSeconds: 120,
    minInstances: 0,
}, async (request) => {
    const { action, payload } = request.data || {};
    const handlerMap = {
        registerFcmToken: notification_handlers_1.registerFcmTokenHandler,
        unregisterFcmToken: notification_handlers_1.unregisterFcmTokenHandler,
        markNotificationRead: notification_handlers_1.markNotificationReadHandler,
        sendStatusUpdateNotification: notification_handlers_1.sendStatusUpdateNotificationHandler,
        sendReminderPush: notification_handlers_1.sendReminderPushHandler,
    };
    const handler = handlerMap[action];
    if (!handler) {
        throw new https_1.HttpsError('invalid-argument', `Unknown notification action: ${action}`);
    }
    return handler(payload, request);
});
//# sourceMappingURL=notification-api.js.map