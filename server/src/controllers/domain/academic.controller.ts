import { CrudController } from "../../core/base.controller.js";
import {
  academicSessionService, departmentService, schoolClassService, sectionService, subjectService,
} from "../../services/academic.service.js";

export const academicSessionController = new CrudController(academicSessionService);
export const departmentController = new CrudController(departmentService);
export const schoolClassController = new CrudController(schoolClassService);
export const sectionController = new CrudController(sectionService);
export const subjectController = new CrudController(subjectService);
