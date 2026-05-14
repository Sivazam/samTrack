import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Space_Grotesk, Raleway, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConnectivityProvider } from "@/contexts/ConnectivityContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const raleway = Raleway({
  variable: "--font-raleway",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Samhitha Admissions",
  description: "College Admissions Lead Tracking PWA",
  keywords: ["Samhitha", "Admissions", "College", "Leads", "Tracking", "Firebase", "Next.js", "TypeScript"],
  authors: [{ name: "Samhitha Team" }],
  openGraph: {
    title: "Samhitha Admissions",
    description: "College Admissions Lead Tracking PWA",
    url: "https://samhitha.firebaseapp.com",
    siteName: "Samhitha",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Samhitha Admissions",
    description: "College Admissions Lead Tracking PWA",
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Samhitha",
    "format-detection": "telephone=no",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${spaceGrotesk.variable} ${raleway.variable} ${dmSans.variable} antialiased bg-background text-foreground`}
      >
        <ConnectivityProvider>
          <AuthProvider>
            <PWAInstallPrompt />
            {children}
          </AuthProvider>
        </ConnectivityProvider>
        <Toaster />
        <SonnerToaster position="top-right" richColors closeButton />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // PWA Detection and Loading Screen with Cache Busting
              (function() {
                // Stable version identifier - UPDATE THIS FOR EACH DEPLOYMENT
                const APP_VERSION = 'Samhitha-v3-1.1.0';
                
                // PWA Detection removed to prevent double loading screen
                const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                             window.navigator.standalone ||
                             document.referrer.includes('android-app://');

                
                // Service Worker Registration with Cache Busting
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    // DISABLED: Version checking to prevent infinite reload loops
                    // const storedVersion = localStorage.getItem('Samhitha-version');
                    // if (storedVersion && storedVersion !== APP_VERSION) {
                    //   // Version checking disabled
                    // }
                    
                    // Store current version without checking
                    localStorage.setItem('Samhitha-version', APP_VERSION);
                    
                    // Register service worker normally
                    registerServiceWorker();
                    
                    // Initialize background notifications for PWA
                    if (isPWA && 'Notification' in window) {
                      if (Notification.permission === 'default') {
                        // Request permission for PWA users
                        Notification.requestPermission().then(permission => {
                          if (permission === 'granted') {
                            console.log('📱 Background notifications enabled for PWA');
                          }
                        });
                      } else if (Notification.permission === 'granted') {
                        console.log('📱 Background notifications already enabled for PWA');
                      }
                    }
                  });
                }
                
                function registerServiceWorker() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful', { 
                        scope: registration.scope,
                        version: APP_VERSION 
                      });
                      
                      // Listen for updates - DISABLED to prevent infinite reload loops
                      // registration.addEventListener('updatefound', () => {
                      //   const installingWorker = registration.installing;
                      //   installingWorker.addEventListener('statechange', () => {
                      //     if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                      //       // Version checking logic disabled to prevent reload loops
                      //       console.log('Service worker updated, but automatic reload disabled');
                      //     }
                      //   });
                      // });
                    })
                    .catch(function(err) {
                      console.error('ServiceWorker registration failed', err);
                    });
                }
                
                // Show update notification - DISABLED to prevent infinite reload loops
                // function showUpdateNotification() {
                //   // Function removed to prevent automatic reloads
                // }
                
                // Remove any existing update notification that might be stuck
                if (typeof window !== 'undefined') {
                  const existingNotification = document.querySelector('[data-update-notification]');
                  if (existingNotification) {
                    existingNotification.remove();
                  }
                  
                  // Clear problematic version storage to prevent reload loops
                  localStorage.removeItem('Samhitha-version');
                }
                
                // Listen for cache cleared messages from service worker
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data && event.data.type === 'CACHE_CLEARED') {
                      console.log('Cache cleared by service worker');
                      // Optionally reload the page
                      window.location.reload();
                    }
                  });
                }
                
                // Manual cache bust function (can be called from dev tools)
                window.forceCacheBust = function() {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.controller.postMessage({ type: 'CACHE_BUST' });
                  }
                };
                
                // Debug function to force update (remove in production)
                window.addEventListener('keydown', function(e) {
                  if (e.ctrlKey && e.shiftKey && e.key === 'U') {
                    localStorage.removeItem('Samhitha-version');
                    window.forceCacheBust();
                    console.log('Manual cache bust triggered');
                  }
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
