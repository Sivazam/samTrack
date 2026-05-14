/**
 * Feature Flags Service
 *
 * Reads from Firestore `config/features` (single doc, readable by any auth user).
 * Each flag is either a plain boolean OR a `{ enabled, tenantOverrides }` object
 * for per-tenant overrides controlled by Super Admin.
 *
 * Doc shape (example):
 * {
 *   crossWholesalerDelivery: {
 *     enabled: true,                       // global default
 *     tenantOverrides: {
 *       'tenantId123': false               // disable for one tenant
 *     }
 *   },
 *   someSimpleFlag: true
 * }
 */

import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type FeatureFlagKey = 'crossWholesalerDelivery';

export interface FeatureFlagRule {
  enabled: boolean;
  tenantOverrides?: Record<string, boolean>;
}

export type FeatureFlagValue = boolean | FeatureFlagRule;

export interface FeatureFlagsDoc {
  [key: string]: FeatureFlagValue;
}

const FEATURES_DOC_PATH = 'config/features';

/** Resolve a flag value to a boolean for a specific tenant. */
export function resolveFlag(
  value: FeatureFlagValue | undefined,
  tenantId?: string | null,
  defaultValue = false
): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (tenantId && value.tenantOverrides && tenantId in value.tenantOverrides) {
    return value.tenantOverrides[tenantId];
  }
  return value.enabled;
}

/** One-shot fetch (uses Firestore cache when offline). */
export async function getFeatureFlags(): Promise<FeatureFlagsDoc> {
  try {
    const snap = await getDoc(doc(db, FEATURES_DOC_PATH));
    return (snap.exists() ? (snap.data() as FeatureFlagsDoc) : {}) || {};
  } catch (err) {
    console.warn('[feature-flags] Failed to fetch:', err);
    return {};
  }
}

/** Subscribe to live flag updates. */
export function subscribeFeatureFlags(
  callback: (flags: FeatureFlagsDoc) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, FEATURES_DOC_PATH),
    (snap) => callback((snap.exists() ? (snap.data() as FeatureFlagsDoc) : {}) || {}),
    (err) => {
      console.warn('[feature-flags] Subscription error:', err);
      callback({});
    }
  );
}
