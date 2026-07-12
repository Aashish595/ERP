import { CrudController } from "../../core/base.controller.js";
import type { EnrollmentRecord } from "../../models/enrollment.model.js";
import { enrollmentService } from "../../services/enrollment.service.js";

export class EnrollmentController extends CrudController<EnrollmentRecord> {}
export const enrollmentController = new EnrollmentController(enrollmentService);
