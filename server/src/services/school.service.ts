import { CrudService } from "../core/base.service.js";
import type { SchoolRecord } from "../models/school.model.js";
import { schoolRepository } from "../repositories/school.repository.js";

export class SchoolService extends CrudService<SchoolRecord> {}
export const schoolService = new SchoolService(schoolRepository);
