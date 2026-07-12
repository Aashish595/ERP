import { createHash } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "../errors.js";

export class MeetingProviderService {
  joinUrl(input: { name: string; meetingId: string; password: string }) {
    if (!config.BBB_URL || !config.BBB_SECRET) throw new ApiError(503, "BigBlueButton is not configured");
    const parameters = new URLSearchParams({ fullName: input.name, meetingID: input.meetingId, password: input.password, redirect: "true" }).toString();
    const checksum = createHash("sha1").update(`join${parameters}${config.BBB_SECRET}`).digest("hex");
    return `${config.BBB_URL.replace(/\/$/, "")}/join?${parameters}&checksum=${checksum}`;
  }
}

export const meetingProviderService = new MeetingProviderService();
