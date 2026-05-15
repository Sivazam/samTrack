'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegistrar
 *
 * Registers the PWA service worker on mount using useEffect.
 * Replaces the previous dangerouslySetInnerHTML <script> approach
 * which could cause removeChild TypeErrors during SSR/hydration.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Stable version identifier
    const APP_VERSION = 'Samhitha-v3-1.1.0';

    // PWA Detection
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error -- iOS Safari specific
      window.navigator.standalone ||
      document.referrer.includes('android-app://');

    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Store current version
        localStorage.setItem('Samhitha-version', APP_VERSION);

        // Register service worker
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('ServiceWorker registration successful', {
              scope: registration.scope,
              version: APP_VERSION,
            });
          })
          .catch((err) => {
            console.error('ServiceWorker registration failed', err);
          });

        // Initialize background notifications for PWA
        if (isPWA && 'Notification' in window) {
          if (Notification.permission === 'default') {
            Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                console.log('Background notifications enabled for PWA');
              }
            });
          }
        }
      });
    }

    // Remove any existing update notification that might be stuck
    const existingNotification = document.querySelector(
      '[data-update-notification]',
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    // Clear problematic version storage to prevent reload loops
    localStorage.removeItem('Samhitha-version');

    // Listen for cache cleared messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_CLEARED') {
          console.log('Cache cleared by service worker');
          window.location.reload();
        }
      });
    }

    // Manual cache bust function (available in dev tools)
    (window as unknown as Record<string, () => void>).forceCacheBust = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CACHE_BUST' });
      }
    };

    // Debug function to force update (Ctrl+Shift+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'U') {
        localStorage.removeItem('Samhitha-version');
        ;(window as unknown as Record<string, () => void>).forceCacheBust?.();
        console.log('Manual cache bust triggered');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
}
