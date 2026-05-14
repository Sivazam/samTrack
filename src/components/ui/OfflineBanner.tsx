'use client';

import { WifiOff, Signal } from 'lucide-react';
import { useConnectionStatus } from '@/contexts/ConnectivityContext';

/**
 * Non-blocking banner shown when offline or on a very slow connection.
 *
 * - Offline  → yellow/amber bar: "You're offline — viewing cached data."
 * - Slow     → softer amber bar: "Slow connection — actions may take longer."
 *
 * Renders nothing when connectivity is normal.
 */
export function OfflineBanner() {
  const { isOnline, isSlowConnection } = useConnectionStatus();

  if (isOnline && !isSlowConnection) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span>You&apos;re offline — viewing cached data. Some actions are disabled.</span>
      </div>
    );
  }

  // Slow connection
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-900">
      <Signal className="h-4 w-4 flex-shrink-0" />
      <span>Slow connection detected — actions may take longer.</span>
    </div>
  );
}
