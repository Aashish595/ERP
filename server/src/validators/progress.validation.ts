import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { LessonProgressModel } from "../models/progress.model.js";

export const createProgressSchema = createPayloadSchema(LessonProgressModel);
export const updateProgressSchema = createUpdateSchema(LessonProgressModel);
