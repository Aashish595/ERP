import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { AcademicSessionModel, DepartmentModel, SchoolClassModel, SectionModel, SubjectModel } from "../models/academic.model.js";

export const createAcademicSessionSchema = createPayloadSchema(AcademicSessionModel);
export const updateAcademicSessionSchema = createUpdateSchema(AcademicSessionModel);
export const createDepartmentSchema = createPayloadSchema(DepartmentModel);
export const updateDepartmentSchema = createUpdateSchema(DepartmentModel);
export const createSchoolClassSchema = createPayloadSchema(SchoolClassModel);
export const updateSchoolClassSchema = createUpdateSchema(SchoolClassModel);
export const createSectionSchema = createPayloadSchema(SectionModel);
export const updateSectionSchema = createUpdateSchema(SectionModel);
export const createSubjectSchema = createPayloadSchema(SubjectModel);
export const updateSubjectSchema = createUpdateSchema(SubjectModel);
