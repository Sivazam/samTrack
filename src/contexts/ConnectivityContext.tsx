'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
/// <reference path="../types/network-information.d.ts" />

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConnectivityState {
  /** Browser says we're online (navigator.onLine) */
  navigatorOnline: boolean;
  /** Firestore snapshot.metadata.fromCache === false (server connected) */
  firestoreConnected: boolean;
  /** Network Information API: effectiveType is slow-2g or 2g */
  slowConnection: boolean;
}

interface ConnectivityContextValue extends ConnectivityState {
  /** Derived: true when both navigatorOnline AND firestoreConnected */
  isOnline: boolean;
  /** Derived: true when slow-2g or 2g */
  isSlowConnection: boolean;
  /** Call from any onSnapshot callback to report fromCache status */
  reportSnapshotMeta: (fromCache: boolean) => void;
}

const ConnectivityContext = createContext<ConnectivityContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectivityState>({
    navigatorOnline: typeof window !== 'undefined' ? navigator.onLine : true,
    firestoreConnected: true, // Optimistic default — avoids false offline flash
    slowConnection: false,
  });

  // ── Navigator online/offline events ──
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const goOnline = () => setState(s => ({ ...s, navigatorOnline: true }));
    const goOffline = () => setState(s => ({ ...s, navigatorOnline: false }));

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Network Information API (Chromium-only) ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const conn = (navigator as any).connection as NetworkInformation | undefined;
    if (!conn) return;

    const checkSpeed = () => {
      const slow = conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
      setState(s => (s.slowConnection !== slow ? { ...s, slowConnection: slow } : s));
    };

    checkSpeed();
    conn.addEventListener('change', checkSpeed);
    return () => conn.removeEventListener('change', checkSpeed);
  }, []);

  // ── Firestore fromCache reporter ──
  const reportSnapshotMeta = useCallback((fromCache: boolean) => {
    // fromCache === true → Firestore disconnected
    // fromCache === false → Firestore connected
    const connected = !fromCache;
    setState(s => (s.firestoreConnected !== connected ? { ...s, firestoreConnected: connected } : s));
  }, []);

  // ── Derived values ──
  const isOnline = state.navigatorOnline && state.firestoreConnected;
  const isSlowConnection = state.slowConnection;

  return (
    <ConnectivityContext.Provider
      value={{ ...state, isOnline, isSlowConnection, reportSnapshotMeta }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Full connectivity status + reportSnapshotMeta callback */
export function useConnectionStatus() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error('useConnectionStatus must be used within ConnectivityProvider');
  }
  return ctx;
}
