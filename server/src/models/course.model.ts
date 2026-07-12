import { defineModel } from "../core/model.js";

export interface CourseRecord extends Record<string, unknown> {
  id: number;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  subject_id?: unknown;
  academic_session_id?: unknown;
  title?: unknown;
  description?: unknown;
  thumbnail_url?: unknown;
  teacher_id?: unknown;
  status?: unknown;
  is_active?: unknown;
}

export const CourseModel = defineModel<CourseRecord>({
  name: "Course", table: "courses", primaryKey: "id",
  fields: ["class_id","section_id","section_name","subject_id","academic_session_id","title","description","thumbnail_url","teacher_id","status","is_active"],
  requiredFields: ["title","teacher_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

