import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { ExamModel } from "../models/exam.model.js";

export const createExamSchema = createPayloadSchema(ExamModel);
export const updateExamSchema = createUpdateSchema(ExamModel);
