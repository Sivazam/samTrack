import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30">
      <div className="max-w-md w-full text-center p-8 space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-xl">
          <svg viewBox="0 0 40 40" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 8L4 16L20 24L36 16L20 8Z" fill="white" fillOpacity="0.95" />
            <path d="M10 19V27C10 27 14 32 20 32C26 32 30 27 30 27V19" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-800">404</h1>
        <p className="text-slate-500">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium rounded-xl shadow-lg shadow-indigo-200/50 hover:from-indigo-700 hover:to-violet-700 transition-all"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
