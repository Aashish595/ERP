import { SqlRepository } from "../core/base.repository.js";
import { EnrollmentModel, type EnrollmentRecord } from "../models/enrollment.model.js";

export class EnrollmentRepository extends SqlRepository<EnrollmentRecord> {
  constructor() { super(EnrollmentModel); }
}

export const enrollmentRepository = new EnrollmentRepository();
