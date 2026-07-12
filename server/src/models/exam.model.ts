import { defineModel } from "../core/model.js";

export interface ExamRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  name?: unknown;
  exam_type?: unknown;
  description?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  result_status?: unknown;
  is_active?: unknown;
  published_at?: unknown;
}

export const ExamModel = defineModel<ExamRecord>({
  name: "Exam", table: "exams", primaryKey: "id",
  fields: ["academic_session_id","class_id","section_id","section_name","name","exam_type","description","start_date","end_date","result_status","is_active","published_at"],
  requiredFields: ["class_id","name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface ExamSubjectRecord extends Record<string, unknown> {
  id: number;
  exam_id?: unknown;
  subject_id?: unknown;
  teacher_id?: unknown;
  max_marks?: unknown;
  pass_marks?: unknown;
  exam_date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  room?: unknown;
  timetable_note?: unknown;
  is_active?: unknown;
}

export const ExamSubjectModel = defineModel<ExamSubjectRecord>({
  name: "ExamSubject", table: "exam_subjects", primaryKey: "id",
  fields: ["exam_id","subject_id","teacher_id","max_marks","pass_marks","exam_date","start_time","end_time","room","timetable_note","is_active"],
  requiredFields: ["exam_id","subject_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface ExamMarkRecord extends Record<string, unknown> {
  id: number;
  exam_subject_id?: unknown;
  student_id?: unknown;
  marks_obtained?: unknown;
  grade?: unknown;
  is_absent?: unknown;
  pass_status?: unknown;
  remarks?: unknown;
}

export const ExamMarkModel = defineModel<ExamMarkRecord>({
  name: "ExamMark", table: "exam_marks", primaryKey: "id",
  fields: ["exam_subject_id","student_id","marks_obtained","grade","is_absent","pass_status","remarks"],
  requiredFields: ["exam_subject_id","student_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
});

