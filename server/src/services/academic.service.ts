import { CrudService } from "../core/base.service.js";
import {
  academicSessionRepository, departmentRepository, schoolClassRepository, sectionRepository, subjectRepository,
} from "../repositories/academic.repository.js";

export const academicSessionService = new CrudService(academicSessionRepository);
export const departmentService = new CrudService(departmentRepository);
export const schoolClassService = new CrudService(schoolClassRepository);
export const sectionService = new CrudService(sectionRepository);
export const subjectService = new CrudService(subjectRepository);
