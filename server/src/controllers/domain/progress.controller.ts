import { CrudController } from "../../core/base.controller.js";
import type { LessonProgressRecord } from "../../models/progress.model.js";
import { progressService } from "../../services/progress.service.js";

export class ProgressController extends CrudController<LessonProgressRecord> {}
export const progressController = new ProgressController(progressService);
