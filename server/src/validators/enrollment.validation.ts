import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { EnrollmentModel } from "../models/enrollment.model.js";

export const createEnrollmentSchema = createPayloadSchema(EnrollmentModel);
export const updateEnrollmentSchema = createUpdateSchema(EnrollmentModel);
