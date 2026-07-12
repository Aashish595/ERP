"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-4 text-red-500" size={34} />
        <h2 className="text-xl font-bold text-slate-900">This page could not load</h2>
        <p className="mt-2 text-sm text-slate-500">The server may be temporarily unavailable. Your saved data has not been changed.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    </div>
  );
}
