import { createHash } from "node:crypto";
import { config } from "../config.js";
import { ApiError } from "../errors.js";

type BbbParameters = Record<string, string>;

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function xmlTag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match?.[1] == null ? null : decodeXml(match[1].trim());
}

export class MeetingProviderService {
  private assertConfigured() {
    if (!config.BBB_URL || !config.BBB_SECRET) {
      throw new ApiError(503, "BigBlueButton is not configured. Set BBB_URL and BBB_SECRET on the server.");
    }
    return { baseUrl: config.BBB_URL.replace(/\/$/, ""), secret: config.BBB_SECRET };
  }

  private signedUrl(call: string, parameters: BbbParameters) {
    const { baseUrl, secret } = this.assertConfigured();
    const queryString = new URLSearchParams(parameters).toString();
    const checksum = createHash(config.BBB_CHECKSUM_ALGORITHM)
      .update(`${call}${queryString}${secret}`)
      .digest("hex");
    return `${baseUrl}/${call}?${queryString}&checksum=${checksum}`;
  }

  private async call(call: string, parameters: BbbParameters) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.BBB_TIMEOUT_MS);
    try {
      const response = await fetch(this.signedUrl(call, parameters), {
        method: "GET",
        headers: { accept: "application/xml,text/xml" },
        signal: controller.signal,
      });
      const body = await response.text();
      if (!response.ok) throw new ApiError(502, `BigBlueButton returned HTTP ${response.status}`);
      const returnCode = xmlTag(body, "returncode");
      if (returnCode && returnCode.toUpperCase() !== "SUCCESS") {
        throw new ApiError(502, xmlTag(body, "message") || `BigBlueButton ${call} failed`);
      }
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(504, "BigBlueButton did not respond in time");
      }
      throw new ApiError(502, "Unable to connect to BigBlueButton");
    } finally {
      clearTimeout(timeout);
    }
  }

  async createMeeting(input: {
    meetingId: string;
    title: string;
    attendeePassword: string;
    moderatorPassword: string;
    record: boolean;
  }) {
    await this.call("create", {
      meetingID: input.meetingId,
      name: input.title,
      attendeePW: input.attendeePassword,
      moderatorPW: input.moderatorPassword,
      record: String(input.record),
      autoStartRecording: String(input.record),
      allowStartStopRecording: "false",
    });
  }

  joinUrl(input: {
    name: string;
    userId: number | string;
    meetingId: string;
    password: string;
    isModerator: boolean;
  }) {
    return this.signedUrl("join", {
      fullName: input.name,
      meetingID: input.meetingId,
      password: input.password,
      userID: String(input.userId),
      logoutURL: config.FRONTEND_URL,
      role: input.isModerator ? "MODERATOR" : "VIEWER",
      redirect: "true",
    });
  }

  async endMeeting(meetingId: string, moderatorPassword: string) {
    await this.call("end", { meetingID: meetingId, password: moderatorPassword });
  }

  async isMeetingRunning(meetingId: string) {
    const xml = await this.call("isMeetingRunning", { meetingID: meetingId });
    return xmlTag(xml, "running")?.toLowerCase() === "true";
  }

  async getRecordingUrl(meetingId: string) {
    const xml = await this.call("getRecordings", { meetingID: meetingId });
    const status = xmlTag(xml, "state") || xmlTag(xml, "status");
    if (status && !["published", "processed"].includes(status.toLowerCase())) return null;
    return xmlTag(xml, "url");
  }
}

export const meetingProviderService = new MeetingProviderService();
