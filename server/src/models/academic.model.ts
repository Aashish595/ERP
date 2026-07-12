import { defineModel } from "../core/model.js";

export interface AcademicSessionRecord extends Record<string, unknown> {
  id: number;
  name?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  is_active?: unknown;
}

export const AcademicSessionModel = defineModel<AcademicSessionRecord>({
  name: "AcademicSession", table: "academic_sessions", primaryKey: "id",
  fields: ["name","start_date","end_date","is_active"],
  requiredFields: ["name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface DepartmentRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  name?: unknown;
  code?: unknown;
  description?: unknown;
  is_active?: unknown;
}

export const DepartmentModel = defineModel<DepartmentRecord>({
  name: "Department", table: "departments", primaryKey: "id",
  fields: ["academic_session_id","name","code","description","is_active"],
  requiredFields: ["name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface SchoolClassRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  department_id?: unknown;
  name?: unknown;
  code?: unknown;
  sections?: unknown;
  is_active?: unknown;
}

export const SchoolClassModel = defineModel<SchoolClassRecord>({
  name: "SchoolClass", table: "school_classes", primaryKey: "id",
  fields: ["academic_session_id","department_id","name","code","sections","is_active"],
  requiredFields: ["name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface SectionRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  class_id?: unknown;
  name?: unknown;
  is_active?: unknown;
}

export const SectionModel = defineModel<SectionRecord>({
  name: "Section", table: "sections", primaryKey: "id",
  fields: ["academic_session_id","class_id","name","is_active"],
  requiredFields: ["class_id","name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface SubjectRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  department_id?: unknown;
  class_id?: unknown;
  name?: unknown;
  code?: unknown;
  sections?: unknown;
  is_active?: unknown;
}

export const SubjectModel = defineModel<SubjectRecord>({
  name: "Subject", table: "subjects", primaryKey: "id",
  fields: ["academic_session_id","department_id","class_id","name","code","sections","is_active"],
  requiredFields: ["name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

