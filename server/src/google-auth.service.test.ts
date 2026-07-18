import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";
process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters";
process.env.AI_SERVICE_TOKEN ||= "test-service-token-at-least-24-chars";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:8000/auth/google/callback";

describe("Google OAuth authorization", () => {
  it("creates a state-bound PKCE authorization request", async () => {
    const { createGoogleAuthorization, verifyGoogleAuthorization } = await import("./services/google-auth.service.js");
    const authorization = createGoogleAuthorization("GVS001", "TEACHER");
    const url = new URL(authorization.authorizationUrl);
    const state = url.searchParams.get("state");

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("redirect_uri")).toBe(process.env.GOOGLE_CALLBACK_URL);
    expect(state).toBeTruthy();

    const verified = verifyGoogleAuthorization(authorization.cookie, state!);
    expect(verified.schoolCode).toBe("GVS001");
    expect(verified.selectedRole).toBe("TEACHER");
    expect(verified.verifier.length).toBeGreaterThan(40);
  });

  it("rejects a mismatched OAuth state", async () => {
    const { createGoogleAuthorization, verifyGoogleAuthorization } = await import("./services/google-auth.service.js");
    const authorization = createGoogleAuthorization("GVS001");
    expect(() => verifyGoogleAuthorization(authorization.cookie, "wrong-state")).toThrow("invalid");
  });
});
