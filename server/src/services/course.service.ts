import { CrudService } from "../core/base.service.js";
import type { CourseRecord } from "../models/course.model.js";
import { courseRepository } from "../repositories/course.repository.js";

export class CourseService extends CrudService<CourseRecord> {}
export const courseService = new CourseService(courseRepository);
