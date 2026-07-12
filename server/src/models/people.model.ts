import { defineModel } from "../core/model.js";

export interface ParentGuardianRecord extends Record<string, unknown> {
  id: number;
  user_id?: unknown;
  full_name?: unknown;
  relation?: unknown;
  email?: unknown;
  phone?: unknown;
  alternate_phone?: unknown;
  occupation?: unknown;
  address?: unknown;
  is_active?: unknown;
}

export const ParentGuardianModel = defineModel<ParentGuardianRecord>({
  name: "ParentGuardian", table: "parent_guardians", primaryKey: "id",
  fields: ["user_id","full_name","relation","email","phone","alternate_phone","occupation","address","is_active"],
  requiredFields: ["full_name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface StudentRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  user_id?: unknown;
  guardian_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  admission_no?: unknown;
  roll_number?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
  gender?: unknown;
  date_of_birth?: unknown;
  blood_group?: unknown;
  photo_url?: unknown;
  address?: unknown;
  admission_date?: unknown;
  status?: unknown;
  is_active?: unknown;
}

export const StudentModel = defineModel<StudentRecord>({
  name: "Student", table: "students", primaryKey: "id",
  fields: ["academic_session_id","user_id","guardian_id","class_id","section_id","section_name","admission_no","roll_number","first_name","last_name","email","phone","gender","date_of_birth","blood_group","photo_url","address","admission_date","status","is_active"],
  requiredFields: ["admission_no","first_name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface TeacherRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  user_id?: unknown;
  department_id?: unknown;
  employee_id?: unknown;
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  gender?: unknown;
  qualification?: unknown;
  specialization?: unknown;
  joining_date?: unknown;
  photo_url?: unknown;
  address?: unknown;
  status?: unknown;
  is_active?: unknown;
}

export const TeacherModel = defineModel<TeacherRecord>({
  name: "Teacher", table: "teachers", primaryKey: "id",
  fields: ["academic_session_id","user_id","department_id","employee_id","full_name","email","phone","gender","qualification","specialization","joining_date","photo_url","address","status","is_active"],
  requiredFields: ["employee_id","full_name"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: true,
  softDeleteField: "is_active",
});

export interface TeacherSubjectRecord extends Record<string, unknown> {
  id: number;
  academic_session_id?: unknown;
  teacher_id?: unknown;
  subject_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
}

export const TeacherSubjectModel = defineModel<TeacherSubjectRecord>({
  name: "TeacherSubject", table: "teacher_subjects", primaryKey: "id",
  fields: ["academic_session_id","teacher_id","subject_id","class_id","section_id","section_name"],
  requiredFields: ["teacher_id","subject_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: false,
});

export interface ClassTeacherAssignmentRecord extends Record<string, unknown> {
  id: number;
  teacher_id?: unknown;
  class_id?: unknown;
  section_id?: unknown;
  section_name?: unknown;
  academic_session_id?: unknown;
}

export const ClassTeacherAssignmentModel = defineModel<ClassTeacherAssignmentRecord>({
  name: "ClassTeacherAssignment", table: "class_teacher_assignments", primaryKey: "id",
  fields: ["teacher_id","class_id","section_id","section_name","academic_session_id"],
  requiredFields: ["teacher_id","class_id"],
  schoolScoped: true, hasCreatedAt: true, hasUpdatedAt: false,
});

