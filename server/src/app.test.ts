import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("./db.js", () => ({
  query: vi.fn(async () => ({ rows: [{ "?column?": 1 }], rowCount: 1 })),
  transaction: vi.fn(),
  pool: { end: vi.fn() },
  sqlIdentifier: (value: string) => `"${value}"`,
}));

describe("API infrastructure", () => {
  it("returns a dependency-free health response", async () => {
    process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";
    process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters";
    process.env.AI_SERVICE_TOKEN ||= "test-service-token-at-least-24-chars";
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("express-api");
  });

  it("accepts the legacy double-slash health URL", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("//health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("protects unknown application paths before disclosing route details", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/does-not-exist");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ detail: "Not authenticated" });
  });
});
