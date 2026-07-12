import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { LessonModel } from "../models/lesson.model.js";

export const createLessonSchema = createPayloadSchema(LessonModel);
export const updateLessonSchema = createUpdateSchema(LessonModel);
