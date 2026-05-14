import { useState, useEffect, useRef } from 'react';
import { useConnectionStatus } from '@/contexts/ConnectivityContext';

/**
 * Hook to track the user's online status with 2-second debounce on going offline.
 * Consumes ConnectivityContext for Firestore-aware connectivity.
 * Returns true if the user is online, false otherwise.
 */
export function useOnlineStatus() {
    const { isOnline: ctxOnline } = useConnectionStatus();
    const [isOnline, setIsOnline] = useState(ctxOnline);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (ctxOnline) {
            // Going online → instant
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            setIsOnline(true);
        } else {
            // Going offline → 2s debounce to avoid button flicker
            if (timerRef.current) return; // already pending
            timerRef.current = setTimeout(() => {
                setIsOnline(false);
                timerRef.current = null;
            }, 2000);
        }
        return () => {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        };
    }, [ctxOnline]);

    return isOnline;
}
