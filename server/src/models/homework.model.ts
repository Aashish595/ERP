import { defineModel } from "../core/model.js";

export interface HomeworkAssignmentRecord extends Record<string, unknown> {
  id: number;
  teacher_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  subject_id?: unknown;
  academic_session_id?: unknown;
  title?: unknown;
  description?: unknown;
  due_date?: unknown;
  attachment_url?: unknown;
  attachment_filename?: unknown;
  is_active?: unknown;
}

export const HomeworkAssignmentModel = defineModel<HomeworkAssignmentRecord>({
  name: "HomeworkAssignment", table: "homework_assignments", primaryKey: "id",
  fields: ["teacher_id","class_id","section_id","section_name","subject_id","academic_session_id","title","description","due_date","attachment_url","attachment_filename","is_active"],
  requiredFields: ["class_id","title","due_date"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface HomeworkSubmissionRecord extends Record<string, unknown> {
  id: number;
  homework_id?: unknown;
  student_id?: unknown;
  answer_text?: unknown;
  attachment_url?: unknown;
  attachment_filename?: unknown;
  status?: unknown;
  teacher_feedback?: unknown;
  checked_at?: unknown;
}

export const HomeworkSubmissionModel = defineModel<HomeworkSubmissionRecord>({
  name: "HomeworkSubmission", table: "homework_submissions", primaryKey: "id",
  fields: ["homework_id","student_id","answer_text","attachment_url","attachment_filename","status","teacher_feedback","checked_at"],
  requiredFields: ["homework_id","student_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

