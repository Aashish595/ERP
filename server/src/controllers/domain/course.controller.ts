import { CrudController } from "../../core/base.controller.js";
import type { CourseRecord } from "../../models/course.model.js";
import { courseService } from "../../services/course.service.js";

export class CourseController extends CrudController<CourseRecord> {}
export const courseController = new CourseController(courseService);
