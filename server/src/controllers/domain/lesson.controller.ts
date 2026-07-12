import { CrudController } from "../../core/base.controller.js";
import type { LessonRecord } from "../../models/lesson.model.js";
import { lessonService } from "../../services/lesson.service.js";

export class LessonController extends CrudController<LessonRecord> {}
export const lessonController = new LessonController(lessonService);
