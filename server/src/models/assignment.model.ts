import { defineModel } from "../core/model.js";

export interface AssignmentRecord extends Record<string, unknown> {
  id: number;
  title?: unknown;
  description?: unknown;
  due_date?: unknown;
  course_id?: unknown;
}

export const AssignmentModel = defineModel<AssignmentRecord>({
  name: "Assignment", table: "assignments", primaryKey: "id",
  fields: ["title","description","due_date","course_id"],
  requiredFields: ["title","course_id"],
  schoolScoped: false, hasCreatedAt: true, hasUpdatedAt: false,
});

