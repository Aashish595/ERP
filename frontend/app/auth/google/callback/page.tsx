"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BackendWakeupNotice } from "@/components/auth/BackendWakeupNotice";
import { Card } from "@/components/ui";
import { apiFetch, dashboardPathForRole, saveAuth } from "@/lib/api";
import { ensureBackendReady } from "@/lib/backendWakeup";
import type { AuthResponse } from "@/types";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = new URLSearchParams(window.location.search).get("code");
    window.history.replaceState({}, "", window.location.pathname);
    if (!code) {
      setError("Google did not return a valid sign-in code. Please try again.");
      return;
    }

    void (async () => {
      try {
        if (!(await ensureBackendReady())) throw new Error("The server is still unavailable. Please try again.");
        const auth = await apiFetch<AuthResponse>("/auth/google/exchange", {
          method: "POST",
          cache: "no-store",
          body: JSON.stringify({ code }),
        });
        saveAuth(auth);
        setComplete(true);
        router.replace(dashboardPathForRole(auth.user.role, Boolean(auth.user.must_change_password)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md space-y-5 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          {complete ? <CheckCircle2 size={28} /> : <LoaderCircle className={error ? "" : "animate-spin"} size={28} />}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{error ? "Sign-in could not be completed" : complete ? "Signed in" : "Completing Google sign-in…"}</h1>
          <p className="mt-2 text-sm text-slate-500">{error || (complete ? "Opening your portal now." : "Please keep this tab open for a moment.")}</p>
        </div>
        <BackendWakeupNotice />
        {error && <Link href="/login" className="inline-flex text-sm font-semibold text-blue-700 underline underline-offset-4">Return to login</Link>}
      </Card>
    </main>
  );
}
