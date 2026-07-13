import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("./db.js", () => ({
  query: queryMock,
  transaction: vi.fn(),
  pool: { end: vi.fn() },
  sqlIdentifier: (value: string) => `"${value}"`,
}));

describe("communication compatibility", () => {
  it("serves the original /communication prefix and complete overview response", async () => {
    process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";
    process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters";
    process.env.AI_SERVICE_TOKEN ||= "test-service-token-at-least-24-chars";
    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM users WHERE id")) return { rows: [{ id: 7, school_id: 3, full_name: "Admin", email: "admin@example.com", login_id: "admin", role: "SCHOOL_ADMIN", is_active: true, must_change_password: false }], rowCount: 1 };
      if (sql.includes("communication_announcements")) return { rows: [{ announcements: 2, upcoming_events: 3, open_complaints: 1 }], rowCount: 1 };
      if (sql.includes("COUNT(*)::int AS count")) return { rows: [{ count: 4 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const token = jwt.sign({ sub: "7", role: "SCHOOL_ADMIN", school_id: 3, type: "access" }, process.env.JWT_SECRET, { algorithm: "HS256" });
    const { createApp } = await import("./app.js");
    const app = createApp();
    const response = await request(app).get("/communication/overview").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ announcements: 2, upcoming_events: 3, open_complaints: 1, unread_notifications: 4 });

    const formerBrokenPath = await request(app).get("/overview").set("Authorization", `Bearer ${token}`);
    expect(formerBrokenPath.status).toBe(404);
  });
});
