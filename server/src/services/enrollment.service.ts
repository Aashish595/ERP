import { CrudService } from "../core/base.service.js";
import type { EnrollmentRecord } from "../models/enrollment.model.js";
import { enrollmentRepository } from "../repositories/enrollment.repository.js";

export class EnrollmentService extends CrudService<EnrollmentRecord> {}
export const enrollmentService = new EnrollmentService(enrollmentRepository);
