import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { CourseModel } from "../models/course.model.js";

export const createCourseSchema = createPayloadSchema(CourseModel);
export const updateCourseSchema = createUpdateSchema(CourseModel);
