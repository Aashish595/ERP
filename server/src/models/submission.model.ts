import { defineModel } from "../core/model.js";

export interface SubmissionRecord extends Record<string, unknown> {
  id: number;
  student_id?: unknown;
  assignment_id?: unknown;
  file_url?: unknown;
  file_public_id?: unknown;
  grade?: unknown;
  feedback?: unknown;
  submitted_at?: unknown;
}

export const SubmissionModel = defineModel<SubmissionRecord>({
  name: "Submission", table: "submissions", primaryKey: "id",
  fields: ["student_id","assignment_id","file_url","file_public_id","grade","feedback","submitted_at"],
  requiredFields: ["student_id","assignment_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

