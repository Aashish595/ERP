import { API_BASE } from "@/lib/api";

export type BackendWakeupPhase = "idle" | "checking" | "waking" | "ready" | "failed";

export type BackendWakeupSnapshot = {
  phase: BackendWakeupPhase;
  attempt: number;
};

const INITIAL_SNAPSHOT: BackendWakeupSnapshot = { phase: "idle", attempt: 0 };
const READY_TTL_MS = 60_000;
const MAX_WAKEUP_MS = 70_000;
const listeners = new Set<() => void>();

let snapshot = INITIAL_SNAPSHOT;
let wakeupPromise: Promise<boolean> | null = null;
let lastReadyAt = 0;

function publish(next: BackendWakeupSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function healthCheck() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function subscribeToBackendWakeup(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBackendWakeupSnapshot() {
  return snapshot;
}

export function getServerBackendWakeupSnapshot() {
  return INITIAL_SNAPSHOT;
}

export function ensureBackendReady(force = false): Promise<boolean> {
  if (!force && snapshot.phase === "ready" && Date.now() - lastReadyAt < READY_TTL_MS) {
    return Promise.resolve(true);
  }
  if (wakeupPromise) return wakeupPromise;

  wakeupPromise = (async () => {
    const startedAt = Date.now();
    let attempt = 0;

    while (Date.now() - startedAt < MAX_WAKEUP_MS) {
      attempt += 1;
      publish({ phase: attempt === 1 ? "checking" : "waking", attempt });
      if (await healthCheck()) {
        lastReadyAt = Date.now();
        publish({ phase: "ready", attempt });
        return true;
      }
      if (Date.now() - startedAt < MAX_WAKEUP_MS) await wait(2_000);
    }

    publish({ phase: "failed", attempt });
    return false;
  })().finally(() => {
    wakeupPromise = null;
  });

  return wakeupPromise;
}
