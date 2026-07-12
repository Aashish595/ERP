import { CrudService } from "../core/base.service.js";
import type { LessonProgressRecord } from "../models/progress.model.js";
import { progressRepository } from "../repositories/progress.repository.js";

export class ProgressService extends CrudService<LessonProgressRecord> {}
export const progressService = new ProgressService(progressRepository);
