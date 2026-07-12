import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { AssignmentModel } from "../models/assignment.model.js";

export const createAssignmentSchema = createPayloadSchema(AssignmentModel);
export const updateAssignmentSchema = createUpdateSchema(AssignmentModel);
