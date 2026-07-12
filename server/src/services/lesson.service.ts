import { CrudService } from "../core/base.service.js";
import type { LessonRecord } from "../models/lesson.model.js";
import { lessonRepository } from "../repositories/lesson.repository.js";

export class LessonService extends CrudService<LessonRecord> {}
export const lessonService = new LessonService(lessonRepository);
