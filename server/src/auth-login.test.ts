import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";
process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters";
process.env.AI_SERVICE_TOKEN ||= "test-service-token-at-least-24-chars";
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("./db.js", () => ({
  query: queryMock,
  transaction: vi.fn(),
  pool: { end: vi.fn() },
  sqlIdentifier: (value: string) => `"${value}"`,
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async () => true),
    hash: vi.fn(async () => "hashed"),
  },
}));

describe("portal-aware authentication", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("reports Google sign-in as disabled when credentials are not configured", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/auth/google/status");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ enabled: false });
  });

  it("directs an administrator away from the user portal", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 3, school_code: "GVS001" }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{
          id: 7,
          school_id: 3,
          full_name: "Admin",
          email: "admin@example.com",
          login_id: "admin@example.com",
          role: "SCHOOL_ADMIN",
          is_active: true,
          must_change_password: false,
          hashed_password: "hashed",
        }],
        rowCount: 1,
      });

    const { createApp } = await import("./app.js");
    const response = await request(createApp()).post("/auth/login").send({
      school_code: "GVS001",
      login_id: "admin@example.com",
      password: "secret",
      portal: "USER",
    });

    expect(response.status).toBe(403);
    expect(response.body.detail).toContain("administration login");
  });

  it("directs a student away from the administration portal", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 3, school_code: "GVS001" }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [{
          id: 9,
          school_id: 3,
          full_name: "Student",
          email: "student@example.com",
          login_id: "STU001",
          role: "STUDENT",
          is_active: true,
          must_change_password: false,
          hashed_password: "hashed",
        }],
        rowCount: 1,
      });

    const { createApp } = await import("./app.js");
    const response = await request(createApp()).post("/auth/login").send({
      school_code: "GVS001",
      login_id: "STU001",
      password: "secret",
      portal: "ADMIN",
    });

    expect(response.status).toBe(403);
    expect(response.body.detail).toContain("student, teacher, or parent login");
  });
});
