import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "../errors.js";

export class PaymentService {
  verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): void {
    if (!config.RAZORPAY_KEY_SECRET) throw new ApiError(503, "Razorpay is not configured");
    const expected = createHmac("sha256", config.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(signature || "");
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      throw new ApiError(400, "Invalid payment signature");
    }
  }
}

export const paymentService = new PaymentService();
