'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export function usePWA() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if app is already installed
        const checkInstalled = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isInWebAppiOS = (window.navigator as any).standalone === true;
            return isStandalone || isInWebAppiOS;
        };

        // Check if iOS device
        const checkIOS = () => {
            return /iPad|iPhone|iPod/.test(navigator.userAgent);
        };

        setIsInstalled(checkInstalled());
        setIsIOS(checkIOS());

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            toast.success('App installed successfully!');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const installApp = useCallback(async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                toast.success('Installing app...');
            } else {
                toast.info('Install cancelled');
            }

            setDeferredPrompt(null);
        } catch (error) {
            console.error('Error during installation:', error);
            toast.error('Failed to install app');
        }
    }, [deferredPrompt]);

    return {
        isInstalled,
        isIOS,
        canInstall: !!deferredPrompt,
        installApp,
        // Helper to show button if not installed and potentially on mobile
        showInstallButton: !isInstalled
    };
}
