'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30">
      <div className="max-w-md w-full text-center p-8 space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-xl">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Something went wrong</h2>
        <p className="text-slate-500">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium rounded-xl shadow-lg shadow-indigo-200/50 hover:from-indigo-700 hover:to-violet-700 transition-all"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
