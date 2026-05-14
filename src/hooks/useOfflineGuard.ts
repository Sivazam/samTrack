'use client';

import { useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Offline guard hook — wraps mutations so they fail gracefully when offline.
 * Mirrors the Samhitha pattern: guardedMutation() shows a toast on offline,
 * otherwise executes the async callback.
 */
export function useOfflineGuard() {
  const isOnline = useOnlineStatus();

  const guardedMutation = useCallback(async <T>(
    mutationFn: () => Promise<T>,
    label?: string,
  ): Promise<T> => {
    if (!isOnline) {
      throw new Error(`You are offline. ${(label || 'Action')} requires internet.`);
    }
    return mutationFn();
  }, [isOnline]);

  return { guardedMutation, isOnline };
}
