"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupStaleReminders = exports.processDailyReminders = exports.processReminders = exports.onUserUpdated = exports.onReminderStatusChanged = exports.onReminderCreated = exports.onTeamDeleted = exports.onTeamUpdated = exports.onStatusUpdateCreated = exports.onLeadDeleted = exports.onLeadUpdated = exports.onLeadCreated = exports.notificationApi = exports.criticalApi = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK FIRST — before any module that calls admin.firestore() etc.
admin.initializeApp();
// Re-export for Cloud Functions
var critical_api_1 = require("./critical-api");
Object.defineProperty(exports, "criticalApi", { enumerable: true, get: function () { return critical_api_1.criticalApi; } });
var notification_api_1 = require("./notification-api");
Object.defineProperty(exports, "notificationApi", { enumerable: true, get: function () { return notification_api_1.notificationApi; } });
var stats_triggers_1 = require("./stats-triggers");
Object.defineProperty(exports, "onLeadCreated", { enumerable: true, get: function () { return stats_triggers_1.onLeadCreated; } });
Object.defineProperty(exports, "onLeadUpdated", { enumerable: true, get: function () { return stats_triggers_1.onLeadUpdated; } });
Object.defineProperty(exports, "onLeadDeleted", { enumerable: true, get: function () { return stats_triggers_1.onLeadDeleted; } });
Object.defineProperty(exports, "onStatusUpdateCreated", { enumerable: true, get: function () { return stats_triggers_1.onStatusUpdateCreated; } });
Object.defineProperty(exports, "onTeamUpdated", { enumerable: true, get: function () { return stats_triggers_1.onTeamUpdated; } });
Object.defineProperty(exports, "onTeamDeleted", { enumerable: true, get: function () { return stats_triggers_1.onTeamDeleted; } });
Object.defineProperty(exports, "onReminderCreated", { enumerable: true, get: function () { return stats_triggers_1.onReminderCreated; } });
Object.defineProperty(exports, "onReminderStatusChanged", { enumerable: true, get: function () { return stats_triggers_1.onReminderStatusChanged; } });
Object.defineProperty(exports, "onUserUpdated", { enumerable: true, get: function () { return stats_triggers_1.onUserUpdated; } });
var scheduled_jobs_1 = require("./scheduled-jobs");
Object.defineProperty(exports, "processReminders", { enumerable: true, get: function () { return scheduled_jobs_1.processReminders; } });
Object.defineProperty(exports, "processDailyReminders", { enumerable: true, get: function () { return scheduled_jobs_1.processDailyReminders; } });
Object.defineProperty(exports, "cleanupStaleReminders", { enumerable: true, get: function () { return scheduled_jobs_1.cleanupStaleReminders; } });
//# sourceMappingURL=index.js.map