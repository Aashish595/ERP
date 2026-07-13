import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
let meetingProviderService: (typeof import("./services/meeting-provider.service.js"))["meetingProviderService"];
let paymentService: (typeof import("./services/payment.service.js"))["paymentService"];

beforeAll(async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost/test";
  process.env.JWT_SECRET ||= "test-secret-that-is-at-least-32-characters";
  process.env.AI_SERVICE_TOKEN ||= "test-service-token-at-least-24-chars";
  process.env.BBB_URL = "https://bbb.example.test/bigbluebutton/api";
  process.env.BBB_SECRET = "bbb-test-secret";
  process.env.BBB_CHECKSUM_ALGORITHM = "sha1";
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "razorpay-test-secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "razorpay-webhook-secret";
  vi.stubGlobal("fetch", fetchMock);
  ({ meetingProviderService } = await import("./services/meeting-provider.service.js"));
  ({ paymentService } = await import("./services/payment.service.js"));
});

beforeEach(() => fetchMock.mockReset());

describe("BigBlueButton integration", () => {
  it("creates a recorded room with a valid BBB checksum", async () => {
    fetchMock.mockResolvedValue(new Response("<response><returncode>SUCCESS</returncode></response>", { status: 200 }));
    await meetingProviderService.createMeeting({
      meetingId: "erp-3-123",
      title: "Mathematics revision",
      attendeePassword: "viewer-secret",
      moderatorPassword: "teacher-secret",
      record: true,
    });

    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const checksum = calledUrl.searchParams.get("checksum");
    calledUrl.searchParams.delete("checksum");
    const queryString = calledUrl.searchParams.toString();
    expect(checksum).toBe(createHash("sha1").update(`create${queryString}bbb-test-secret`).digest("hex"));
    expect(calledUrl.searchParams.get("meetingID")).toBe("erp-3-123");
    expect(calledUrl.searchParams.get("autoStartRecording")).toBe("true");
  });

  it("reads the published playback URL and signs role-aware joins", async () => {
    fetchMock.mockResolvedValue(new Response(
      "<response><returncode>SUCCESS</returncode><recording><state>published</state><playback><format><url>https://bbb.example.test/playback/1?a=1&amp;b=2</url></format></playback></recording></response>",
      { status: 200 },
    ));
    await expect(meetingProviderService.getRecordingUrl("erp-3-123"))
      .resolves.toBe("https://bbb.example.test/playback/1?a=1&b=2");
    const join = new URL(meetingProviderService.joinUrl({
      name: "Teacher One",
      userId: 7,
      meetingId: "erp-3-123",
      password: "teacher-secret",
      isModerator: true,
    }));
    expect(join.searchParams.get("role")).toBe("MODERATOR");
    expect(join.searchParams.get("userID")).toBe("7");
  });
});

describe("Razorpay verification", () => {
  it("accepts only the server-order checkout signature", () => {
    const signature = createHmac("sha256", "razorpay-test-secret")
      .update("order_server_123|pay_ABC123")
      .digest("hex");
    expect(() => paymentService.verifyCheckoutSignature("order_server_123", "pay_ABC123", signature)).not.toThrow();
    expect(() => paymentService.verifyCheckoutSignature("order_other", "pay_ABC123", signature)).toThrow("Invalid payment signature");
  });

  it("verifies the exact raw webhook payload", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const signature = createHmac("sha256", "razorpay-webhook-secret").update(body).digest("hex");
    expect(() => paymentService.verifyWebhookSignature(body, signature)).not.toThrow();
    expect(() => paymentService.verifyWebhookSignature(Buffer.from("{}"), signature)).toThrow("Invalid webhook signature");
  });
});

describe("migration contracts", () => {
  it("starts a fresh database with the complete ERP schema", () => {
    const sql = readFileSync(path.resolve("migrations/001_initial.sql"), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS schools");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS meetings");
  });

  it("includes durable payment orders and meeting attendance", () => {
    const sql = readFileSync(path.resolve("migrations/002_integrations.sql"), "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS fee_payment_orders");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS meeting_attendance");
    expect(sql).toContain("uq_fee_payments_razorpay_payment");
  });

  it("keeps the AI stream token contract consumed by the frontend", () => {
    const client = readFileSync(path.resolve("../ai-service/app/client.py"), "utf8");
    expect(client).toContain("{'token': chunk}");
    expect(client).not.toContain("{'content': chunk}");
  });
});
