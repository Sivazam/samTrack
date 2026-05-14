/**
 * Enhanced FCM Manager with De-duplication
 * Handles FCM notifications with duplicate prevention
 */

import { onMessage } from 'firebase/messaging';
import { getMessagingInstance } from './fcm';
import { notificationDeduplicator } from './notification-deduplicator';
import { auth } from '@/lib/firebase';

export interface EnhancedFCMConfig {
  enableToast: boolean;
  enableBrowserNotification: boolean;
  autoCloseDelay: number;
  requireInteraction: boolean;
}

class EnhancedFCMManager {
  private static instance: EnhancedFCMManager;
  private config: EnhancedFCMConfig;
  private isInitialized = false;
  private unsubscribeFunctions: Array<() => void> = [];

  private constructor() {
    this.config = {
      enableToast: true,
      enableBrowserNotification: true,
      autoCloseDelay: 5000,
      requireInteraction: false
    };
  }

  static getInstance(): EnhancedFCMManager {
    if (!EnhancedFCMManager.instance) {
      EnhancedFCMManager.instance = new EnhancedFCMManager();
    }
    return EnhancedFCMManager.instance;
  }

  /**
   * Initialize the enhanced FCM manager
   */
  initialize(config?: Partial<EnhancedFCMConfig>): void {
    if (this.isInitialized) {
      console.warn('Enhanced FCM Manager already initialized');
      return;
    }

    this.config = { ...this.config, ...config };
    this.setupForegroundListener();
    this.isInitialized = true;

    console.warn('✅ Enhanced FCM Manager initialized with config:', this.config);
  }

  /**
   * Set up foreground message listener with de-duplication and auth check
   */
  private setupForegroundListener(): void {
    try {
      const messagingInstance = getMessagingInstance();
      if (!messagingInstance) {
        console.warn('⚠️ Firebase Messaging instance not available');
        return;
      }

      const unsubscribe = onMessage(messagingInstance, (payload: any) => {
        console.warn('📱 Enhanced FCM foreground message received:', payload?.data?.type || 'unknown');

        // 🔐 SECURITY: Check if user is authenticated before processing
        if (!this.isUserAuthenticated()) {
          console.log('🚫 User not authenticated - discarding foreground notification:', payload.notification?.title);
          return;
        }

        // 🔥 DUPLICATE PREVENTION: Skip OTP notifications as they're handled by service worker
        const notificationData = payload.data || {};
        if (notificationData.type === 'otp') {
          console.log('🚫 OTP notification handled by service worker - skipping foreground display to prevent duplicates');
          return;
        }

        // Check de-duplicator before showing notification (only if available)
        const deduplicator = notificationDeduplicator;
        if (deduplicator) {
          const { shouldShow, reason } = deduplicator.shouldShowNotification(payload);

          console.log(`🔍 Notification decision: ${shouldShow ? 'SHOW' : 'BLOCK'} - ${reason}`);

          if (shouldShow) {
            this.handleNotification(payload);
          } else {
            console.log('🚫 Notification blocked by de-duplicator:', reason);
          }
        } else {
          // Fallback to showing notification if deduplicator is not available (SSR case)
          console.log('📱 Deduplicator not available, showing notification directly');
          this.handleNotification(payload);
        }
      });

      this.unsubscribeFunctions.push(unsubscribe);
    } catch (error) {
      console.error('❌ Error setting up enhanced FCM listener:', error);
    }
  }

  /**
   * Check if user is currently authenticated
   * This prevents showing notifications to logged-out users
   */
  private isUserAuthenticated(): boolean {
    try {
      // Use Firebase Auth instance to check current user
      return !!auth.currentUser;
    } catch (error) {
      console.error('❌ Error checking auth status in enhanced FCM manager:', error);
      return false;
    }
  }

  /**
   * Handle notification display
   */
  private handleNotification(payload: any): void {
    const notificationData = payload.data || {};
    // Data-only messages: title/body come from data, not notification
    const notificationTitle = payload.notification?.title || notificationData.title || 'Samhitha Notification';
    const notificationBody = payload.notification?.body || notificationData.body || 'You have a new notification';

    // Show system notification via Service Worker (reliable on desktop Chrome)
    if (this.config.enableBrowserNotification) {
      this.showBrowserNotification(notificationTitle, notificationBody, notificationData);
    }
  }

  /**
   * Show browser system notification via Service Worker.
   * Using SW's showNotification() instead of new Notification() because
   * Chrome on desktop reliably displays SW notifications but often
   * silently drops page-level new Notification() calls.
   * Uses navigator.serviceWorker.ready (always resolves) instead of
   * navigator.serviceWorker.controller (null after SW update/hard refresh).
   */
  private async showBrowserNotification(title: string, body: string, data: any): Promise<void> {
    try {
      const notificationOptions: NotificationOptions = {
        body,
        icon: data.icon || '/notification-large-192x192.png',
        badge: data.badge || '/badge-72x72.png',
        tag: data.tag || 'default',
        requireInteraction: this.config.requireInteraction,
        data
      };

      // Use SW registration's showNotification — always works, even when
      // navigator.serviceWorker.controller is null (after SW update / hard refresh)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, notificationOptions);
        console.warn('✅ Browser notification shown via SW registration:', title);
      } else {
        console.warn('⚠️ Service Worker not supported — cannot show notification');
      }
    } catch (error) {
      console.error('❌ Error showing browser notification:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EnhancedFCMConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('📝 Enhanced FCM config updated:', this.config);
  }

  /**
   * Send test notification
   */
  sendTestNotification(): void {
    const testPayload = {
      notification: {
        title: '🧪 Test Notification',
        body: 'This is a test from Enhanced FCM Manager'
      },
      data: {
        type: 'test',
        tag: 'test-notification',
        timestamp: Date.now().toString()
      }
    };

    const deduplicator = notificationDeduplicator;
    if (deduplicator) {
      const { shouldShow, reason } = deduplicator.shouldShowNotification(testPayload);

      if (shouldShow) {
        this.handleNotification(testPayload);
        console.log('🧪 Test notification sent');
      } else {
        console.warn('🚫 Test notification blocked:', reason);
      }
    } else {
      this.handleNotification(testPayload);
      console.log('🧪 Test notification sent (deduplicator not available)');
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    const deduplicator = notificationDeduplicator;
    return {
      isInitialized: this.isInitialized,
      config: this.config,
      deduplicatorInfo: deduplicator ? deduplicator.getDebugInfo() : null,
      unsubscribeCount: this.unsubscribeFunctions.length
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.unsubscribeFunctions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error cleaning up FCM listener:', error);
      }
    });
    this.unsubscribeFunctions = [];
    this.isInitialized = false;
    console.log('🧹 Enhanced FCM Manager cleaned up');
  }
}

export const enhancedFCMManager = EnhancedFCMManager.getInstance();