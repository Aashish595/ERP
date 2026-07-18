"use client";

import { AlertCircle, LoaderCircle, RotateCcw, Server } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  ensureBackendReady,
  getBackendWakeupSnapshot,
  getServerBackendWakeupSnapshot,
  subscribeToBackendWakeup,
} from "@/lib/backendWakeup";

const SHOW_WAKEUP_UI = process.env.NEXT_PUBLIC_BACKEND_WAKEUP_UI !== "false";

export function BackendWakeupNotice() {
  const status = useSyncExternalStore(
    subscribeToBackendWakeup,
    getBackendWakeupSnapshot,
    getServerBackendWakeupSnapshot,
  );
  const [showChecking, setShowChecking] = useState(false);

  useEffect(() => {
    void ensureBackendReady();
  }, []);

  useEffect(() => {
    if (status.phase !== "checking") {
      setShowChecking(false);
      return;
    }
    const timer = window.setTimeout(() => setShowChecking(true), 700);
    return () => window.clearTimeout(timer);
  }, [status.phase]);

  if (!SHOW_WAKEUP_UI || status.phase === "idle" || status.phase === "ready") return null;
  if (status.phase === "checking" && !showChecking) return null;

  if (status.phase === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900" role="alert">
        <AlertCircle className="mt-0.5 shrink-0" size={18} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">The server is taking longer than expected.</p>
          <p className="mt-0.5 text-xs text-amber-800">Check your connection, then try again. Your form entries are safe.</p>
        </div>
        <button
          type="button"
          onClick={() => void ensureBackendReady(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-amber-100"
        >
          <RotateCcw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-900" role="status" aria-live="polite">
      <div className="relative mt-0.5 shrink-0">
        <Server size={18} />
        <LoaderCircle className="absolute -bottom-1 -right-1 animate-spin rounded-full bg-blue-50" size={12} />
      </div>
      <div>
        <p className="font-semibold">Preparing your portal…</p>
        <p className="mt-0.5 text-xs text-blue-800">
          The beta server is waking up. This can take about 30–60 seconds, and sign-in will continue automatically.
        </p>
      </div>
    </div>
  );
}
