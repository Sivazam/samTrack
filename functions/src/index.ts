import * as admin from 'firebase-admin';

// Initialize Admin SDK FIRST — before any module that calls admin.firestore() etc.
admin.initializeApp();

// Re-export for Cloud Functions
export { criticalApi } from './critical-api';
export { notificationApi } from './notification-api';
export {
  onLeadCreated,
  onLeadUpdated,
  onLeadDeleted,
  onStatusUpdateCreated,
  onTeamUpdated,
  onTeamDeleted,
  onReminderCreated,
  onReminderStatusChanged,
  onUserUpdated,
} from './stats-triggers';
export {
  processReminders,
  processDailyReminders,
  cleanupStaleReminders,
} from './scheduled-jobs';

