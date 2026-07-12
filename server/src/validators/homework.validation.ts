import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { HomeworkAssignmentModel } from "../models/homework.model.js";

export const createHomeworkSchema = createPayloadSchema(HomeworkAssignmentModel);
export const updateHomeworkSchema = createUpdateSchema(HomeworkAssignmentModel);
