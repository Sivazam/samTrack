import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { registerFcmTokenHandler, unregisterFcmTokenHandler, markNotificationReadHandler, sendStatusUpdateNotificationHandler, sendReminderPushHandler } from './notification-handlers';

export const notificationApi = onCall(
  {
    region: 'asia-south1',
    memory: '256MiB',
    timeoutSeconds: 120,
    minInstances: 0,
  },
  async (request) => {
    const { action, payload } = request.data || {};

    const handlerMap: Record<string, (payload: any, request: any) => Promise<any>> = {
      registerFcmToken: registerFcmTokenHandler,
      unregisterFcmToken: unregisterFcmTokenHandler,
      markNotificationRead: markNotificationReadHandler,
      sendStatusUpdateNotification: sendStatusUpdateNotificationHandler,
      sendReminderPush: sendReminderPushHandler,
    };

    const handler = handlerMap[action];
    if (!handler) {
      throw new HttpsError('invalid-argument', `Unknown notification action: ${action}`);
    }

    return handler(payload, request);
  }
);
