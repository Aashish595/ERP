import { SqlRepository } from "../core/base.repository.js";
import {
  AcademicSessionModel, DepartmentModel, SchoolClassModel, SectionModel, SubjectModel,
  type AcademicSessionRecord, type DepartmentRecord, type SchoolClassRecord, type SectionRecord, type SubjectRecord,
} from "../models/academic.model.js";

export const academicSessionRepository = new SqlRepository<AcademicSessionRecord>(AcademicSessionModel);
export const departmentRepository = new SqlRepository<DepartmentRecord>(DepartmentModel);
export const schoolClassRepository = new SqlRepository<SchoolClassRecord>(SchoolClassModel);
export const sectionRepository = new SqlRepository<SectionRecord>(SectionModel);
export const subjectRepository = new SqlRepository<SubjectRecord>(SubjectModel);
