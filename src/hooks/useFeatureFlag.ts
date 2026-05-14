'use client';

/**
 * useFeatureFlag — React hook for reading a feature flag, with per-tenant override support.
 *
 * Usage:
 *   const { enabled, loading } = useFeatureFlag('crossWholesalerDelivery');
 *   if (!enabled) return null;
 *
 * The hook subscribes to `config/features` once globally (multiple consumers share the
 * same snapshot via a module-level cache) and resolves the flag for the current
 * user's tenant.
 *
 * Default behavior when the doc is missing or unreadable: flag returns `defaultValue`
 * (which itself defaults to `true` for the deliveries flag — see DEFAULTS).
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  FeatureFlagKey,
  FeatureFlagsDoc,
  resolveFlag,
  subscribeFeatureFlags,
} from '@/lib/feature-flags';

// Default values when the flag is not present in Firestore (e.g. doc not yet created).
// New features ship enabled-by-default; super admin can flip them off via Firestore.
const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  crossWholesalerDelivery: true,
};

// Module-level cache so all hook callers share a single Firestore subscription.
let cachedFlags: FeatureFlagsDoc | null = null;
let listeners: Array<(flags: FeatureFlagsDoc) => void> = [];
let unsubscribe: (() => void) | null = null;

function ensureSubscribed() {
  if (unsubscribe) return;
  unsubscribe = subscribeFeatureFlags((flags) => {
    cachedFlags = flags;
    listeners.forEach((cb) => cb(flags));
  });
}

function subscribe(cb: (flags: FeatureFlagsDoc) => void): () => void {
  listeners.push(cb);
  ensureSubscribed();
  if (cachedFlags) cb(cachedFlags);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    if (listeners.length === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

export interface UseFeatureFlagResult {
  enabled: boolean;
  loading: boolean;
}

export function useFeatureFlag(
  key: FeatureFlagKey,
  defaultValue?: boolean
): UseFeatureFlagResult {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const [flags, setFlags] = useState<FeatureFlagsDoc | null>(cachedFlags);

  useEffect(() => {
    return subscribe(setFlags);
  }, []);

  const enabled = useMemo(() => {
    const fallback = defaultValue ?? DEFAULTS[key] ?? false;
    if (!flags) return fallback;
    return resolveFlag(flags[key], tenantId, fallback);
  }, [flags, key, tenantId, defaultValue]);

  return { enabled, loading: flags === null };
}
