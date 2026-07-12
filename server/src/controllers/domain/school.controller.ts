import { CrudController } from "../../core/base.controller.js";
import type { SchoolRecord } from "../../models/school.model.js";
import { schoolService } from "../../services/school.service.js";

export class SchoolController extends CrudController<SchoolRecord> {}
export const schoolController = new SchoolController(schoolService);
