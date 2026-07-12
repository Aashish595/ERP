import { defineModel } from "../core/model.js";

export interface EnrollmentRecord extends Record<string, unknown> {
  id: number;
  student_id?: unknown;
  course_id?: unknown;
  progress?: unknown;
  enrolled_at?: unknown;
}

export const EnrollmentModel = defineModel<EnrollmentRecord>({
  name: "Enrollment", table: "enrollments", primaryKey: "id",
  fields: ["student_id","course_id","progress","enrolled_at"],
  requiredFields: ["student_id","course_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

