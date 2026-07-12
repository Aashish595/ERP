import { defineModel } from "../core/model.js";

export interface StudentAttendanceRecord extends Record<string, unknown> {
  id: number;
  session_id?: unknown;
  student_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  marked_by?: unknown;
  date?: unknown;
  status?: unknown;
  note?: unknown;
}

export const StudentAttendanceModel = defineModel<StudentAttendanceRecord>({
  name: "StudentAttendance", table: "student_attendance", primaryKey: "id",
  fields: ["session_id","student_id","class_id","section_id","section_name","marked_by","date","status","note"],
  requiredFields: ["session_id","student_id","class_id","date"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

