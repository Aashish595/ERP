import { defineModel } from "../core/model.js";

export interface TimetablePeriodRecord extends Record<string, unknown> {
  id: number;
  period_number?: unknown;
  name?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  is_break?: unknown;
  is_active?: unknown;
}

export const TimetablePeriodModel = defineModel<TimetablePeriodRecord>({
  name: "TimetablePeriod", table: "timetable_periods", primaryKey: "id",
  fields: ["period_number","name","start_time","end_time","is_break","is_active"],
  requiredFields: ["period_number","name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface TimetableDayRecord extends Record<string, unknown> {
  id: number;
  day_of_week?: unknown;
  display_name?: unknown;
  sort_order?: unknown;
  is_active?: unknown;
}

export const TimetableDayModel = defineModel<TimetableDayRecord>({
  name: "TimetableDay", table: "timetable_days", primaryKey: "id",
  fields: ["day_of_week","display_name","sort_order","is_active"],
  requiredFields: ["day_of_week","display_name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface TimetableEntryRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  day_id?: unknown;
  period_id?: unknown;
  subject_id?: unknown;
  teacher_id?: unknown;
  room?: unknown;
  note?: unknown;
  is_active?: unknown;
}

export const TimetableEntryModel = defineModel<TimetableEntryRecord>({
  name: "TimetableEntry", table: "timetable_entries", primaryKey: "id",
  fields: ["academic_session_id","class_id","section_id","section_name","day_id","period_id","subject_id","teacher_id","room","note","is_active"],
  requiredFields: ["class_id","day_id","period_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

