/**
 * FCM Service — Server-side device management via Firebase Admin SDK
 *
 * This file runs ONLY in Next.js API routes (server-side). It uses the Admin SDK
 * to read/write Firestore, avoiding the client SDK import that would fail or
 * create SSR issues.
 *
 * Dead notification-sending methods (sendNotification, sendNotificationToUser,
 * sendOTPViaFCM, sendPaymentNotificationViaFCM) have been removed — all actual
 * notification sending is done by Cloud Functions (stats-triggers.ts,
 * notification-handlers.ts) using the Admin SDK directly.
 */

import { getFirebaseFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Minimal device shape for server-side usage.
// Timestamps are stored as Admin Firestore Timestamps but may arrive
// as client SDK Timestamps or plain objects — keep the type loose.
interface FCMDeviceRecord {
  token: string;
  deviceId: string;
  userAgent: string;
  lastActive: any;   // Admin Timestamp / client Timestamp / Date
  createdAt: any;
  isActive: boolean;
  machineId?: string;
}

type UserType = 'users' | 'retailers' | 'wholesalers' | 'lineWorkers' | 'superAdmins' | 'tenants';

class FCMService {
  private readonly VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '';

  /**
   * Register a device token for any user type (Admin SDK)
   */
  async registerDevice(
    userId: string,
    deviceToken: string,
    userAgent: string = 'unknown',
    userType: UserType = 'retailers'
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔧 FCM Service: Registering device:', {
        userId,
        userType,
        tokenLength: deviceToken.length,
        tokenPrefix: deviceToken.substring(0, 20) + '...',
        userAgent: userAgent.substring(0, 50) + '...'
      });

      const adminDb = getFirebaseFirestore();
      const userRef = adminDb.collection(userType).doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.error(`❌ FCM Service: ${userType} not found:`, userId);
        return { success: false, message: `${userType} not found` };
      }

      // Check if user account is active
      const userData = userDoc.data() || {};
      if (userData.hasOwnProperty('active') && !userData.active) {
        console.error(`❌ FCM Service: ${userType} is inactive:`, userId);
        return { success: false, message: `${userType} account is inactive` };
      }

      console.log(`✅ FCM Service: ${userType} found and active:`, userId);

      const deviceId = this.generateDeviceId(deviceToken, userAgent);
      const now = FieldValue.serverTimestamp();
      const device: Record<string, any> = {
        token: deviceToken,
        deviceId,
        userAgent,
        lastActive: now,
        createdAt: now,
        isActive: true
      };

      // Get current devices
      const currentDevices: FCMDeviceRecord[] = userData.fcmDevices || [];

      // Check if device already exists
      const existingDeviceIndex = currentDevices.findIndex(d => d.deviceId === deviceId);

      if (existingDeviceIndex >= 0) {
        // Update existing device
        currentDevices[existingDeviceIndex] = {
          ...currentDevices[existingDeviceIndex],
          lastActive: new Date(),
          isActive: true,
          token: deviceToken // Update token in case it changed
        };
        console.log('🔄 FCM Service: Updated existing device:', deviceId);
      } else {
        // Add new device
        currentDevices.push(device as FCMDeviceRecord);
        console.log('➕ FCM Service: Added new device:', deviceId);
      }

      // Update user document
      await userRef.update({
        fcmDevices: currentDevices,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ FCM Service: Device registered successfully for ${userType}:`, userId);
      return { success: true, message: 'Device registered successfully' };

    } catch (error) {
      console.error('❌ FCM Service: Error registering device:', error);
      return { success: false, message: 'Failed to register device' };
    }
  }

  /**
   * Unregister a specific device token for any user type (Admin SDK)
   */
  async unregisterDevice(
    userId: string,
    deviceToken: string,
    userType: UserType = 'retailers'
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🗑️ FCM Service: Unregistering device:', {
        userId,
        userType,
        tokenLength: deviceToken.length,
        tokenPrefix: deviceToken.substring(0, 20) + '...'
      });

      const adminDb = getFirebaseFirestore();
      const userRef = adminDb.collection(userType).doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.error(`❌ FCM Service: ${userType} not found:`, userId);
        return { success: false, message: `${userType} not found` };
      }

      const userData = userDoc.data() || {};
      const currentDevices: FCMDeviceRecord[] = userData.fcmDevices || [];

      // Mark device as inactive instead of removing completely (for audit trail)
      const finalDevices = currentDevices.map(device =>
        device.token === deviceToken
          ? { ...device, isActive: false, lastActive: new Date() }
          : device
      );

      await userRef.update({
        fcmDevices: finalDevices,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`✅ FCM Service: Device unregistered successfully for ${userType}:`, userId);
      return { success: true, message: 'Device unregistered successfully' };

    } catch (error) {
      console.error('❌ FCM Service: Error unregistering device:', error);
      return { success: false, message: 'Failed to unregister device' };
    }
  }

  /**
   * Generate a unique device ID based on token and user agent
   */
  private generateDeviceId(token: string, userAgent: string): string {
    let hash = 0;
    const str = `${token}:${userAgent}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `device_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Check if FCM is properly configured
   */
  isConfigured(): boolean {
    return !!this.VAPID_KEY;
  }

  /**
   * Get active devices for a user (Admin SDK)
   */
  async getActiveDevices(userId: string, userType: UserType = 'retailers'): Promise<FCMDeviceRecord[]> {
    try {
      const adminDb = getFirebaseFirestore();
      const userRef = adminDb.collection(userType).doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return [];
      }

      const userData = userDoc.data() || {};
      const devices: FCMDeviceRecord[] = userData.fcmDevices || [];

      // Return only active devices
      return devices.filter(device => device.isActive);
    } catch (error) {
      console.error('❌ FCM Service: Error getting active devices:', error);
      return [];
    }
  }
}

export const fcmService = new FCMService();