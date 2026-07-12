import { defineModel } from "../core/model.js";

export interface PendingSchoolRegistrationRecord extends Record<string, unknown> {
  id: number;
  owner_email?: unknown;
  otp_hash?: unknown;
  payload_json?: unknown;
  expires_at?: unknown;
  attempts?: unknown;
}

export const PendingSchoolRegistrationModel = defineModel<PendingSchoolRegistrationRecord>({
  name: "PendingSchoolRegistration", table: "pending_school_registrations", primaryKey: "id",
  fields: ["owner_email","otp_hash","payload_json","expires_at","attempts"],
  requiredFields: ["owner_email","otp_hash","payload_json","expires_at"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: true,
});

