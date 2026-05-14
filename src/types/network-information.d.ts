/**
 * Network Information API types (Chromium-only: Chrome, Edge, Opera, Samsung Internet).
 * Falls back gracefully in Firefox / Safari — `navigator.connection` is undefined.
 */

interface NetworkInformation extends EventTarget {
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink: number;
  readonly rtt: number;
  readonly saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => any) | null;
}

interface Navigator {
  readonly connection?: NetworkInformation;
}
