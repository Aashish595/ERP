import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { SchoolModel } from "../models/school.model.js";

export const createSchoolSchema = createPayloadSchema(SchoolModel);
export const updateSchoolSchema = createUpdateSchema(SchoolModel);
