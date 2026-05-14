// ──────────────────────────────────────────────────────────────────
// UNIFIED SERVICE WORKER — PWA caching + Firebase Cloud Messaging
// Version 3.0.0: Merged firebase-messaging-sw.js into sw.js to
// eliminate competing service-worker registrations. Both PWA cache
// management AND FCM background-message handling live here now.
// ──────────────────────────────────────────────────────────────────

// ─── Firebase Cloud Messaging SDK (must be at the very top) ──────
// IMPORTANT: Version MUST match the frontend `firebase` package (12.3.0).
// A version mismatch causes the SW to silently ignore incoming FCM pushes.
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.3.0/firebase-messaging-compat.js');

// Firebase configuration (hardcoded for service worker — MUST MATCH frontend config)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging instance
const messaging = firebase.messaging();

// ─── IndexedDB-backed auth persistence (survives SW restarts) ────
const AUTH_DB_NAME = 'samhitha-sw-auth';
const AUTH_DB_VERSION = 1;
const AUTH_STORE = 'auth-state';
const AUTH_KEY = 'isAuthenticated';

function openAuthDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTH_DB_NAME, AUTH_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPersistedAuthState() {
  try {
    const db = await openAuthDB();
    return new Promise((resolve) => {
      const tx = db.transaction(AUTH_STORE, 'readonly');
      const store = tx.objectStore(AUTH_STORE);
      const request = store.get(AUTH_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('⚠️ SW: Failed to read auth state from IndexedDB:', e);
    return null;
  }
}

async function setPersistedAuthState(isAuthenticated) {
  try {
    const db = await openAuthDB();
    return new Promise((resolve) => {
      const tx = db.transaction(AUTH_STORE, 'readwrite');
      const store = tx.objectStore(AUTH_STORE);
      store.put({ value: isAuthenticated, updatedAt: Date.now() }, AUTH_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('⚠️ SW: Failed to persist auth state to IndexedDB:', e);
  }
}

/**
 * Check if user is currently authenticated.
 * Uses IndexedDB for persistence across SW restarts (critical for desktop browsers).
 * Falls back to in-memory flag, then defaults to TRUE.
 * Rationale for defaulting TRUE: if a push arrived, the FCM token was registered by
 * an authenticated user. The backend manages token lifecycle on logout.
 */
async function isUserAuthenticated() {
  // Fast path: in-memory flag (set by AUTH_STATE_CHANGED postMessage)
  if (typeof self.isAuthenticated === 'boolean') {
    return self.isAuthenticated;
  }

  // Slow path: read from IndexedDB (survives SW termination/restart)
  try {
    const persisted = await getPersistedAuthState();
    if (persisted && typeof persisted.value === 'boolean') {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (persisted.updatedAt && (Date.now() - persisted.updatedAt) > sevenDays) {
        return false; // Stale entry — default to unauthenticated for safety
      }
      self.isAuthenticated = persisted.value;
      return persisted.value;
    }
  } catch (e) {
    console.warn('⚠️ SW: IndexedDB auth read failed:', e);
  }

  // No state found — if a notification arrives the token was registered by an
  // authenticated user, so default to true.
  return true;
}

// ─── Coordination between onBackgroundMessage and push safety net ─────
// In-memory set tracks tags that onBackgroundMessage already handled.
// Used by the push safety net to avoid duplicate notifications.
const _handledPushTags = new Set();

// ─── Handle FCM background messages ──────────────────────────────
// Messages are DATA-ONLY (no top-level `notification` key) so Chrome does NOT
// auto-display anything. This handler has full control over notification display.
messaging.onBackgroundMessage(async (payload) => {
  console.warn('📱 FCM onBackgroundMessage received:', payload?.data?.type || 'unknown', payload?.data?.title || '');

  const data = payload.data || {};
  const tag = data.tag || 'default';

  // Mark this tag as handled so the push safety net skips it
  _handledPushTags.add(tag);
  setTimeout(() => _handledPushTags.delete(tag), 10000); // cleanup after 10s

  const notificationTitle = data.title || payload.notification?.title || 'Samhitha Notification';
  const notificationOptions = {
    body: data.body || payload.notification?.body || 'You have a new notification',
    icon: data.icon || '/notification-large-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    tag,
    requireInteraction: data.requireInteraction === 'true',
    data: data,
  };

  if (data.type === 'REMINDER') {
    notificationOptions.actions = [
      { action: 'open', title: 'Open Lead' },
      { action: 'snooze', title: 'Snooze 1h' },
      { action: 'done', title: 'Mark Done' }
    ];
  }

  try {
    await self.registration.showNotification(notificationTitle, notificationOptions);
    console.warn('✅ SW showNotification succeeded for tag:', tag);
  } catch (e) {
    console.error('❌ SW showNotification failed:', e);
  }
});

// ─── Safety-net push handler for desktop cold starts ─────────────────
// When Chrome is fully closed on desktop and wakes up for a push, the Firebase
// compat SDK may not initialize fast enough to intercept the push event via
// onBackgroundMessage. This raw `push` listener guarantees a notification is
// always shown — the Push API spec REQUIRES a visible notification for every
// push event, or Chrome shows a default "Updated in the background" message.
//
// Coordination strategy:
//   1. Extract the tag from the push payload immediately (before any delay).
//   2. Wait 2.5s for Firebase SDK to process via onBackgroundMessage.
//   3. Check _handledPushTags (in-memory) + getNotifications({tag}) to see
//      if Firebase already showed a notification with this tag.
//   4. If not, show the notification ourselves as a fallback.
//
// This handles ALL notification types.

self.addEventListener('push', function(event) {
  event.waitUntil((async () => {
    // 1. Extract push data immediately (before any delay)
    let data = {};
    try {
      if (event.data) {
        const json = event.data.json();
        // FCM wraps data in .data (data-only messages), .notification, or at root
        data = json.data || json.notification || json;
      }
    } catch (e) {
      try {
        data = { body: event.data ? event.data.text() : 'New notification' };
      } catch (e2) {
        data = { body: 'New notification' };
      }
    }

    const tag = data.tag || `push-${Date.now()}`;

    // 2. Wait for Firebase SDK to handle via onBackgroundMessage
    //    2.5s is enough for warm SW; for cold starts on slow networks the
    //    safety net below will fire — which is the desired behavior.
    await new Promise(r => setTimeout(r, 2500));

    // 3. Check if Firebase's onBackgroundMessage already handled this push
    //    Strategy A: in-memory flag (fast, works when SW is warm)
    if (_handledPushTags.has(tag)) {
      console.warn('📱 Push safety net: Firebase already handled tag:', tag);
      _handledPushTags.delete(tag); // cleanup
      return;
    }

    //    Strategy B: check getNotifications for this specific tag (works for cold starts
    //    where the in-memory flag might not be set yet but notification is visible)
    try {
      const existing = await self.registration.getNotifications({ tag });
      if (existing.length > 0) {
        console.warn('📱 Push safety net: notification with tag already visible:', tag);
        return;
      }
    } catch (e) {
      // getNotifications may fail in some edge cases — continue to show
    }

    // 4. Firebase didn't handle it — show notification ourselves
    const title = data.title || 'Samhitha Notification';
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/notification-large-192x192.png',
      badge: data.badge || '/badge-72x72.png',
      tag: tag,
      requireInteraction: data.requireInteraction === 'true',
      data: data,
    };

    console.warn('📱 Push safety net: Firebase missed this push, showing fallback:', title, '(tag:', tag, ')');
    await self.registration.showNotification(title, options);
  })());
});


const CACHE_VERSION = 'samhitha-v3-2.1.0';
const CACHE_NAME = CACHE_VERSION;
const STATIC_CACHE_NAME = 'samhitha-static-v5';
const RUNTIME_CACHE_NAME = 'samhitha-runtime-v5';
const MAX_RUNTIME_ENTRIES = 150; // Cap runtime cache to prevent unbounded PWA storage growth

// Trim a cache to a maximum number of entries (evicts oldest first)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    for (let i = 0; i < keys.length - maxEntries; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Static assets that should be cached long-term
const STATIC_ASSETS = [
  '/logoMain.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico',
  '/manifest.json'
];

// Core pages that should be cached for offline use
const CORE_PAGES = [
  '/',
  '/pwa-loading'
];

// Cache busting query parameter for dynamic content
const CACHE_BUST_PARAM = '_v=' + CACHE_VERSION;

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('Service Worker installing with version:', CACHE_VERSION);

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),

      // Cache core pages
      caches.open(CACHE_NAME).then(cache => {
        console.log('Caching core pages');
        return cache.addAll(CORE_PAGES.map(url => url + '?' + CACHE_BUST_PARAM));
      })
    ])
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('Service Worker activating with version:', CACHE_VERSION);

  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME &&
              cacheName !== STATIC_CACHE_NAME &&
              cacheName !== RUNTIME_CACHE_NAME &&
              cacheName.startsWith('samhitha-')) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),

      // Take control of all open clients immediately
      self.clients.claim(),

      // Proactively trim runtime cache on activation (cleans up old deployment chunks)
      trimCache(RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES)
    ])
  );
});


// ─── Push subscription change handler (desktop reliability) ──────
// When Chrome's push subscription expires or is invalidated (common on desktop
// after long periods of browser closure), this event fires. Without handling
// it, the user silently stops receiving notifications until they revisit the app.
//
// IMPORTANT: We do NOT manually call pushManager.subscribe() here because
// Firebase SDK manages the push subscription internally via getToken().
// Instead, we notify all open clients so they can call initializeFCM()
// which calls getToken() → Firebase handles the re-subscription properly.
self.addEventListener('pushsubscriptionchange', event => {
  console.warn('🔄 Push subscription changed — notifying clients to re-register FCM token...');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
      });
      if (clients.length === 0) {
        // No open clients — the user will re-register on next visit
        // when initializeFCM() runs during auth flow
        console.warn('⚠️ No open clients to notify — FCM token will refresh on next visit');
      }
    })
  );
});


// Notification click event — smart routing to correct dashboard page
self.addEventListener('notificationclick', event => {
  console.log('📱 Notification clicked:', event.action);

  event.notification.close();

  // If user explicitly dismisses, do nothing further
  if (event.action === 'dismiss') {
    console.log('📱 Notification dismissed');
    return;
  }

  // Determine target URL from notification data
  const data = event.notification.data || {};
  let urlToOpen = data.url || data.clickAction || '/';

  // Handle REMINDER notification actions
  if (event.action === 'snooze') {
    // Queue snooze request via background fetch
    event.waitUntil(
      fetch('/api/fcm/snooze-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: data.reminderId })
      }).catch(() => {})
    );
    event.notification.close();
    return;
  }
  if (event.action === 'done') {
    event.waitUntil(
      fetch('/api/fcm/complete-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderId: data.reminderId })
      }).catch(() => {})
    );
    event.notification.close();
    return;
  }

  // All notification types open the app root — the app's router handles
  // directing the user to the correct dashboard or reminder view.
  urlToOpen = data.url || '/';

  // Try to focus an existing window/tab first, then navigate
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url && new URL(client.url).origin === self.location.origin) {
          return client.focus().then(focusedClient => {
            if (focusedClient) {
              focusedClient.navigate(urlToOpen);
            }
          });
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', event => {
  console.log('📱 Notification closed:', event.notification.tag);
});

// Handle messages from the main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SUBSCRIBE_TO_PUSH') {
    console.log('📱 Subscribing to push notifications');

    event.waitUntil(
      self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.data.publicKey
      })
        .then(subscription => {
          console.log('✅ Push notification subscription successful');

          // Send subscription back to client
          event.ports[0].postMessage({
            type: 'SUBSCRIPTION_SUCCESS',
            subscription: subscription
          });
        })
        .catch(error => {
          console.error('❌ Push notification subscription failed:', error);

          event.ports[0].postMessage({
            type: 'SUBSCRIPTION_ERROR',
            error: error.message
          });
        })
    );
  }

  if (event.data && event.data.type === 'SEND_TEST_NOTIFICATION') {
    console.log('📱 Sending test notification');

    event.waitUntil(
      self.registration.showNotification('Test Notification', {
        body: 'This is a test notification from Samhitha',
        icon: '/icon-192x192.png',
        badge: '/icon-96x96.png',
        tag: 'test-notification'
      })
    );
  }

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    console.log('📱 Showing role-based notification:', event.data.payload);

    const payload = event.data.payload;

    // Enhanced notification options for mobile
    const notificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      badge: payload.badge || '/icon-96x96.png',
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
      actions: payload.actions || [],
      data: {
        type: event.data.type,
        originalData: event.data.originalData
      },
      // Mobile-specific enhancements
      silent: false
    };

    // Add sound if supported
    if ('sound' in Notification.prototype) {
      notificationOptions.sound = '/notification-sound.mp3';
    }

    // Additional mobile-specific handling
    if (payload.requireInteraction) {
      notificationOptions.requireInteraction = true;
    }

    event.waitUntil(
      self.registration.showNotification(payload.title, notificationOptions)
        .then(() => {
          // Trigger vibration on mobile devices after notification is shown
          if ('vibrate' in self && 'vibrate' in self.registration) {
            self.registration.vibrate([200, 100, 200]);
          }
        })
    );
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_BUST') {
    // Force clear all caches and reload
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('samhitha-')) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Notify all clients to reload
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      });
    });
  }

  // Handle auth state changes from main app — persist to IndexedDB for desktop reliability
  if (event.data && event.data.type === 'AUTH_STATE_CHANGED') {
    console.log('🔐 SW received auth state change:', event.data.isAuthenticated);
    self.isAuthenticated = event.data.isAuthenticated;
    setPersistedAuthState(event.data.isAuthenticated);
  }
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle different types of requests
  if (STATIC_ASSETS.includes(url.pathname)) {
    // Static assets - try cache first, then network
    event.respondWith(handleStaticAsset(event.request));
  } else if (url.pathname === '/sw.js' || url.pathname === '/manifest.json') {
    // Service worker and manifest - always network first to get latest version
    event.respondWith(handleVersionedFiles(event.request));
  } else if (url.pathname.startsWith('/_next/')) {
    // CRITICAL: Next.js bundles - ALWAYS network first to prevent stale UI
    event.respondWith(handleNextJsAssets(event.request));
  } else if (event.request.mode === 'navigate') {
    // Navigation requests - network first, fallback to cache
    event.respondWith(handleNavigationRequest(event.request));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - network only
    event.respondWith(handleApiRequest(event.request));
  } else {
    // Other requests - network first with cache fallback
    event.respondWith(handleRuntimeRequest(event.request));
  }
});

// Handle static assets (images, icons, etc.)
async function handleStaticAsset(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If not in cache, fetch from network
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('Static asset fetch failed:', error);
    throw error;
  }
}

// Handle versioned files (service worker, manifest)
async function handleVersionedFiles(request) {
  try {
    // Always fetch from network to get the latest version
    const response = await fetch(request);

    // Cache the response for future use
    if (response && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Fallback to cache if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    // Try network first for fresh content
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('Network request failed, trying cache for navigation');

    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If no cached response, try to return the main page
    const mainPageResponse = await caches.match('/?' + CACHE_BUST_PARAM);
    if (mainPageResponse) {
      return mainPageResponse;
    }

    throw error;
  }
}

// Handle Next.js assets (JS/CSS bundles) - NETWORK FIRST to prevent stale UI
async function handleNextJsAssets(request) {
  try {
    // Always try network first for fresh bundles
    const networkResponse = await fetch(request);

    // Cache successful responses for offline fallback
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      // Evict old entries to prevent unbounded cache growth across deployments
      trimCache(RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES);
    }

    return networkResponse;
  } catch (error) {
    console.log('Network failed for Next.js asset, trying cache:', request.url);

    // Fallback to cache only if network fails (offline scenario)
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Handle API requests
async function handleApiRequest(request) {
  // Always fetch from network for API requests
  return fetch(request);
}

// Handle runtime requests (other assets)
async function handleRuntimeRequest(request) {
  try {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch from network
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      // Evict old entries to prevent unbounded cache growth
      trimCache(RUNTIME_CACHE_NAME, MAX_RUNTIME_ENTRIES);
    }

    return networkResponse;
  } catch (error) {
    console.error('Runtime request failed:', error);
    throw error;
  }
}

// NOTE: SKIP_WAITING and CACHE_BUST are already handled in the main message listener above.
// Duplicate listener removed to prevent double cache-purge.