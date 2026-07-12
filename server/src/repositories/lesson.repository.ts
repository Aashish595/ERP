import { SqlRepository } from "../core/base.repository.js";
import { LessonModel, type LessonRecord } from "../models/lesson.model.js";

export class LessonRepository extends SqlRepository<LessonRecord> {
  constructor() { super(LessonModel); }
}

export const lessonRepository = new LessonRepository();
