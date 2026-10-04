import React from 'react';
import Link from 'next/link';

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl font-bold mb-4">
        ⚡
      </div>
      <h1 className="text-2xl font-bold mb-2">ReliefSync Offline Mode</h1>
      <p className="text-slate-400 max-w-md mb-6 text-sm">
        You are currently without network connection. Your local records, registrations, and distributions remain safe and accessible via the local camp database.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors shadow-lg"
      >
        Return to Camp Dashboard
      </Link>
    </div>
  );
}
