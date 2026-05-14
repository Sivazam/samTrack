/**
 * Device Manager Utility
 * 
 * This utility provides proper device management for multi-device scenarios.
 * It ensures that logout only removes the current device, not all devices.
 */

import { auth } from '@/lib/firebase';

export interface DeviceInfo {
  token: string;
  userAgent: string;
  lastActive: string;
  deviceId: string;
}

/**
 * Get a deterministic machine ID that is the SAME across all browsers on the same physical device.
 * Unlike deviceId (which uses Math.random + localStorage and differs per browser profile),
 * machineId uses only hardware/OS signals: screen size, CPU cores, color depth, platform, language.
 * This allows the server to collapse Chrome + Edge + other browsers on the same machine into one.
 */
export function getMachineId(): string {
  if (typeof window === 'undefined') return '';
  // Deterministic signals — same across all browsers on same machine
  const signals = [
    `${window.screen.width}x${window.screen.height}`,
    `${window.screen.colorDepth}`,
    `${navigator.hardwareConcurrency || 0}`,
    `${navigator.platform || ''}`,
    `${navigator.language || ''}`,
    `${window.screen.availWidth}x${window.screen.availHeight}`,
    `${navigator.maxTouchPoints || 0}`,
  ].join('|');

  let hash = 0;
  for (let i = 0; i < signals.length; i++) {
    const char = signals.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `machine_${Math.abs(hash).toString(16)}`;
}

/**
 * Get the current device's unique identifier (persistent)
 */
export function getCurrentDeviceId(): string {
  if (typeof window === 'undefined') return 'server';

  // 1. Check if we already have a persistent device ID in localStorage
  const storedId = localStorage.getItem('persistentDeviceId');
  if (storedId) return storedId;

  // 2. Generate a new unique device ID if not found
  const userAgent = navigator.userAgent;
  const screenDimensions = `${window.screen.width}x${window.screen.height}`;
  const randomValue = Math.random().toString(36).substring(2, 10); // Add randomness to prevent collisions

  // Create a simple hash
  const str = `${userAgent}|${screenDimensions}|${randomValue}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  const newDeviceId = `device_${Math.abs(hash).toString(16)}`;

  // 3. Store it for future use
  localStorage.setItem('persistentDeviceId', newDeviceId);

  return newDeviceId;
}

/**
 * Get the current FCM token from localStorage
 */
export function getCurrentFCMToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('fcmToken');
}

/**
 * Store the current device's FCM token with device ID
 */
export function storeCurrentDeviceToken(token: string): void {
  if (typeof window === 'undefined') return;

  const deviceId = getCurrentDeviceId();
  const deviceInfo = {
    token,
    deviceId,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('currentDevice', JSON.stringify(deviceInfo));
  localStorage.setItem('fcmToken', token);

  console.log('📱 Stored current device info:', {
    deviceId,
    tokenPrefix: token.substring(0, 20) + '...'
  });
}

/**
 * Get the current device's information
 */
export function getCurrentDeviceInfo(): DeviceInfo | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('currentDevice');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear the current device's information (called during logout)
 */
export function clearCurrentDeviceInfo(): void {
  if (typeof window === 'undefined') return;

  const deviceInfo = getCurrentDeviceInfo();
  if (deviceInfo) {
    console.log('🗑️ Clearing current device info:', {
      deviceId: deviceInfo.deviceId,
      tokenPrefix: deviceInfo.token.substring(0, 20) + '...'
    });
  }

  localStorage.removeItem('currentDevice');
  localStorage.removeItem('fcmToken');
}

/**
 * Check if the current device is registered for notifications
 */
export function isCurrentDeviceRegistered(): boolean {
  const token = getCurrentFCMToken();
  const deviceInfo = getCurrentDeviceInfo();

  return !!(token && deviceInfo && deviceInfo.token === token);
}

/**
 * Log device information for debugging
 */
export function logDeviceInfo(): void {
  if (typeof window === 'undefined') return;

  const deviceInfo = getCurrentDeviceInfo();
  const token = getCurrentFCMToken();

  console.log('📱 Device Info Debug:', {
    deviceId: deviceInfo?.deviceId || 'unknown',
    hasToken: !!token,
    tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
    isRegistered: isCurrentDeviceRegistered(),
    userAgent: navigator.userAgent.substring(0, 50) + '...'
  });
}