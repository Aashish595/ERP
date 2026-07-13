import nodemailer from "nodemailer";
import { config } from "../config.js";
import { ApiError } from "../errors.js";

type EmailMessage = { to: string; subject: string; text: string };

export function smtpConfigured() {
  return Boolean(config.SMTP_HOST && config.SMTP_USERNAME && config.SMTP_PASSWORD && (config.SMTP_FROM_EMAIL || config.SMTP_USERNAME));
}

export async function sendEmail(message: EmailMessage) {
  if (!smtpConfigured()) throw new ApiError(503, "Email delivery is not configured");
  const secure = config.SMTP_PORT === 465;
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure,
    requireTLS: config.SMTP_USE_TLS && !secure,
    auth: { user: config.SMTP_USERNAME!, pass: config.SMTP_PASSWORD! },
  });
  try {
    await transporter.sendMail({
      from: { name: config.SMTP_FROM_NAME, address: config.SMTP_FROM_EMAIL || config.SMTP_USERNAME! },
      ...message,
    });
  } catch (error) {
    console.error("Email delivery failed", error instanceof Error ? error.message : "Unknown SMTP error");
    throw new ApiError(502, "Email delivery failed. Please try again later");
  }
}
