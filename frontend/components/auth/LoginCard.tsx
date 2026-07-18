"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, GraduationCap, School, ShieldCheck } from "lucide-react";

import { AuthLink, Button, Card, Input, Label } from "@/components/ui";
import { BackendWakeupNotice } from "@/components/auth/BackendWakeupNotice";
import { apiFetch, apiUrl, dashboardPathForRole, fileUrl, saveAuth } from "@/lib/api";
import { ensureBackendReady } from "@/lib/backendWakeup";
import { applyBrandingTheme, cacheBrandingTheme, DEFAULT_BRANDING } from "@/lib/branding";
import type { AuthResponse, SchoolBrandingPublic } from "@/types";

type LoginMode = "user" | "admin";
type UserPortalRole = "STUDENT" | "TEACHER" | "PARENT";

const SCHOOL_CODE_KEY = "erp_last_school_code";
const PORTAL_ROLE_KEY = "erp_last_portal_role";

const USER_PORTALS: ReadonlyArray<{
  value: UserPortalRole;
  label: string;
  loginLabel: string;
  loginPlaceholder: string;
}> = [
  { value: "STUDENT", label: "Student", loginLabel: "Student email or admission number", loginPlaceholder: "Your email or admission number" },
  { value: "TEACHER", label: "Teacher", loginLabel: "Teacher email or employee ID", loginPlaceholder: "Your email or employee ID" },
  { value: "PARENT", label: "Parent", loginLabel: "Parent email or parent login ID", loginPlaceholder: "Your email or parent login ID" },
];

const oauthErrors: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  account_inactive: "This account is inactive. Contact your institution administrator.",
  account_not_registered: "No portal account matches that Google email. Ask your institution administrator to register the same email first.",
  admin_password_required: "Administrator accounts must use the separate administration login.",
  google_account_mismatch: "This portal account is linked to a different Google account. Contact your institution administrator.",
  google_failed: "Google could not complete the sign-in. Please try again.",
  incorrect_portal: "This account belongs to a different portal. Select the correct Student, Teacher, or Parent tab and try again.",
  invalid_school: "Enter a valid school or college code before using Google sign-in.",
  session_expired: "The Google sign-in session expired. Please try again.",
  temporarily_unavailable: "Google sign-in is temporarily unavailable. You can still use your password.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.86A6.01 6.01 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.48l3.34-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

export function LoginCard({ mode }: { mode: LoginMode }) {
  const router = useRouter();
  const isAdmin = mode === "admin";
  const [schoolCode, setSchoolCode] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserPortalRole>("STUDENT");
  const [error, setError] = useState("");
  const [brandingPreview, setBrandingPreview] = useState<SchoolBrandingPublic | null>(null);

  useEffect(() => {
    const savedSchoolCode = window.localStorage.getItem(SCHOOL_CODE_KEY);
    if (savedSchoolCode) setSchoolCode(savedSchoolCode);
    const savedRole = window.localStorage.getItem(PORTAL_ROLE_KEY);
    if (USER_PORTALS.some((portal) => portal.value === savedRole)) setSelectedRole(savedRole as UserPortalRole);
  }, []);

  useEffect(() => {
    const normalized = schoolCode.trim().toUpperCase();
    if (normalized.length >= 2) window.localStorage.setItem(SCHOOL_CODE_KEY, normalized);
  }, [schoolCode]);

  useEffect(() => {
    if (!isAdmin) window.localStorage.setItem(PORTAL_ROLE_KEY, selectedRole);
  }, [isAdmin, selectedRole]);

  useEffect(() => {
    if (isAdmin) return;
    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
    if (oauthError) {
      setError(oauthErrors[oauthError] || oauthErrors.google_failed);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    void ensureBackendReady().then(async (ready) => {
      if (!ready || cancelled) return;
      try {
        const status = await apiFetch<{ enabled: boolean }>("/auth/google/status", { cache: "no-store" });
        if (!cancelled) setGoogleEnabled(status.enabled);
      } catch {
        if (!cancelled) setGoogleEnabled(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    const code = schoolCode.trim().toUpperCase();
    if (code.length < 3) {
      setBrandingPreview(null);
      applyBrandingTheme(DEFAULT_BRANDING);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void ensureBackendReady().then(async (ready) => {
        if (!ready || cancelled) return;
        try {
          const data = await apiFetch<SchoolBrandingPublic>(
            `/schools/branding/by-code/${encodeURIComponent(code)}`,
            { cache: "no-store" },
          );
          if (cancelled) return;
          setBrandingPreview(data);
          applyBrandingTheme(data);
          cacheBrandingTheme(data);
        } catch {
          if (cancelled) return;
          setBrandingPreview(null);
          applyBrandingTheme(DEFAULT_BRANDING);
        }
      });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [schoolCode]);

  const previewLogo = fileUrl(brandingPreview?.logo_url);
  const previewName = brandingPreview?.school_name || "School ERP";
  const selectedPortal = USER_PORTALS.find((portal) => portal.value === selectedRole) ?? USER_PORTALS[0];

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!(await ensureBackendReady())) throw new Error("The server is still unavailable. Please retry in a moment.");
      const data = await apiFetch<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          school_code: schoolCode,
          login_id: loginId,
          password,
          portal: isAdmin ? "ADMIN" : "USER",
          selected_role: isAdmin ? undefined : selectedRole,
        }),
      });
      saveAuth(data);
      router.replace(dashboardPathForRole(data.user.role, Boolean(data.user.must_change_password)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const startGoogleLogin = async () => {
    const code = schoolCode.trim().toUpperCase();
    if (code.length < 2) {
      setError("Enter your school or college code before continuing with Google.");
      return;
    }
    setGoogleLoading(true);
    setError("");
    try {
      if (!(await ensureBackendReady())) throw new Error("The server is still unavailable. Please retry in a moment.");
      window.localStorage.setItem(SCHOOL_CODE_KEY, code);
      window.localStorage.setItem(PORTAL_ROLE_KEY, selectedRole);
      const params = new URLSearchParams({ school_code: code, selected_role: selectedRole });
      window.location.assign(apiUrl(`/auth/google/start?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in could not start");
      setGoogleLoading(false);
    }
  };

  const HeaderIcon = isAdmin ? ShieldCheck : GraduationCap;

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, var(--erp-background, #f8fafc), #ffffff, var(--erp-primary-soft, #dbeafe))" }}
    >
      <Card className="w-full max-w-lg border-slate-200/80 p-0 shadow-lg">
        <div className="rounded-t-2xl p-6 text-white" style={{ background: "var(--erp-sidebar, #0f172a)" }}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 p-2" style={{ color: "var(--erp-primary, #2563eb)" }}>
              {previewLogo ? (
                <img src={previewLogo} alt={`${previewName} logo`} className="max-h-full max-w-full object-contain" />
              ) : (
                <School size={24} />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">{previewName}</p>
              <h1 className="text-2xl font-bold">{isAdmin ? "Administration Portal" : "Sign in to your portal"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <HeaderIcon size={17} />
            <span>{isAdmin ? "For authorized institution administrators" : "Students first, with teacher and parent access"}</span>
          </div>
        </div>

        <div className="space-y-5 p-6">
          {!isAdmin && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose your portal">
              {USER_PORTALS.map((portal) => (
                <button
                  key={portal.value}
                  type="button"
                  role="tab"
                  aria-selected={selectedRole === portal.value}
                  disabled={loading || googleLoading}
                  onClick={() => {
                    setSelectedRole(portal.value);
                    setError("");
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selectedRole === portal.value
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"
                  }`}
                >
                  {portal.label}
                </button>
              ))}
            </div>
          )}

          <BackendWakeupNotice />

          <form onSubmit={login} className="space-y-4">
            <div>
              <Label>School / College Code</Label>
              <Input value={schoolCode} onChange={(event) => setSchoolCode(event.target.value.toUpperCase())} required placeholder="Example: GVS001" autoComplete="organization" />
              <p className="mt-1 text-xs text-slate-500">
                {brandingPreview ? `Theme loaded for ${brandingPreview.school_name}.` : "Ask your institution administrator for this code."}
              </p>
            </div>
            <div>
              <Label>{isAdmin ? "Administrator email or login ID" : selectedPortal.loginLabel}</Label>
              <Input value={loginId} onChange={(event) => setLoginId(event.target.value)} required placeholder={isAdmin ? "admin@school.com" : selectedPortal.loginPlaceholder} autoComplete="username" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <Link href="/forgot-password" className="text-xs font-semibold text-slate-700 underline underline-offset-4">Forgot password?</Link>
              </div>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" className="pr-10" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}

            <Button type="submit" disabled={loading || googleLoading} className="w-full py-3">
              {loading ? "Signing in…" : isAdmin ? "Continue to Administration" : "Continue to Portal"}
            </Button>
          </form>

          {!isAdmin && (
            <>
              <div className="flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={() => void startGoogleLogin()}
                disabled={googleEnabled !== true || loading || googleLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <GoogleIcon />
                {googleLoading ? "Opening Google…" : googleEnabled === false ? "Google sign-in unavailable" : "Continue with Google"}
              </button>
              <p className="text-center text-xs leading-5 text-slate-500">
                Google works only when the same verified email is already registered by your institution. It never creates an account or changes your role.
              </p>
            </>
          )}

          <div className="border-t border-slate-100 pt-4 text-center text-sm text-slate-500">
            {isAdmin ? (
              <>Student, teacher, or parent? <AuthLink href="/login">Use the main portal</AuthLink></>
            ) : (
              <div className="space-y-2">
                <p>Administrator? <AuthLink href="/admin/login">Use administration login</AuthLink></p>
                <p>New institution? <AuthLink href="/register-school">Register school or college</AuthLink></p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </main>
  );
}
