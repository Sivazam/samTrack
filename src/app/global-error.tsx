'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    console.error('Global application error:', error);
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-emerald-50/30 to-sky-50/30 p-4">
          <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center border border-emerald-100/50">
            <div className="flex justify-center mb-6">
              <div className={`p-4 rounded-2xl ${isOffline ? 'bg-sky-50' : 'bg-red-50'}`}>
                {isOffline ? (
                  <WifiOff className="w-8 h-8 text-sky-600" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                )}
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              {isOffline ? 'No Internet Connection' : 'Critical System Error'}
            </h2>

            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              {isOffline
                ? 'It looks like you are offline. Please check your internet connection and try again.'
                : 'Something went wrong with the application. Our team has been notified.'}
            </p>

            {process.env.NODE_ENV === 'development' && !isOffline && (
              <div className="mb-6 p-3 bg-red-50 text-red-800 text-xs text-left overflow-auto max-h-32 rounded-lg border border-red-100">
                <p className="font-bold">Error Details:</p>
                <code className="break-all">{error.message}</code>
              </div>
            )}

            <button
              onClick={handleReload}
              className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 shadow-lg ${
                isOffline
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200/50'
                  : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-red-200/50'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              {isOffline ? 'Retry Connection' : 'Reload Application'}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
