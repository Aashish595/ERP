import { SqlRepository } from "../core/base.repository.js";
import { CourseModel, type CourseRecord } from "../models/course.model.js";

export class CourseRepository extends SqlRepository<CourseRecord> {
  constructor() { super(CourseModel); }
}

export const courseRepository = new CourseRepository();
