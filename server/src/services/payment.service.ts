import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "../errors.js";

type RazorpayOrder = {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  receipt: string;
  status: string;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
};

function safeSignatureEqual(expected: string, supplied: string | undefined): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied || "", "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export class PaymentService {
  private credentials() {
    if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
      throw new ApiError(503, "Razorpay is not configured");
    }
    return { keyId: config.RAZORPAY_KEY_ID, keySecret: config.RAZORPAY_KEY_SECRET };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { keyId, keySecret } = this.credentials();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`https://api.razorpay.com/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as T | { error?: { description?: string } } | null;
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload
          ? payload.error?.description
          : undefined;
        throw new ApiError(502, message || "Payment provider request failed");
      }
      if (!payload) throw new ApiError(502, "Payment provider returned an invalid response");
      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, "Payment provider is temporarily unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  async createOrder(input: { amountPaise: number; receipt: string; recordId: number; schoolId: number }) {
    if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
      throw new ApiError(400, "Balance amount is too low for online payment (minimum INR 1)");
    }
    return this.request<RazorpayOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: "INR",
        receipt: input.receipt,
        notes: {
          student_fee_record_id: String(input.recordId),
          school_id: String(input.schoolId),
        },
      }),
    });
  }

  fetchPayment(paymentId: string) {
    if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new ApiError(400, "Invalid Razorpay payment id");
    return this.request<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  }

  verifyCheckoutSignature(serverOrderId: string, paymentId: string, signature: string | undefined): void {
    const { keySecret } = this.credentials();
    const expected = createHmac("sha256", keySecret).update(`${serverOrderId}|${paymentId}`).digest("hex");
    if (!safeSignatureEqual(expected, signature)) throw new ApiError(400, "Invalid payment signature");
  }

  verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    if (!config.RAZORPAY_WEBHOOK_SECRET) throw new ApiError(503, "Razorpay webhook is not configured");
    if (!rawBody) throw new ApiError(400, "Webhook payload is unavailable");
    const expected = createHmac("sha256", config.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (!safeSignatureEqual(expected, signature)) throw new ApiError(400, "Invalid webhook signature");
  }
}

export const paymentService = new PaymentService();
