import { defineModel } from "../core/model.js";

export interface LessonProgressRecord extends Record<string, unknown> {
  id: number;
  student_id?: unknown;
  lesson_id?: unknown;
  completed?: unknown;
  completed_at?: unknown;
}

export const LessonProgressModel = defineModel<LessonProgressRecord>({
  name: "LessonProgress", table: "lesson_progress", primaryKey: "id",
  fields: ["student_id","lesson_id","completed","completed_at"],
  requiredFields: ["student_id","lesson_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

