import { SqlRepository } from "../core/base.repository.js";
import { LessonProgressModel, type LessonProgressRecord } from "../models/progress.model.js";

export class ProgressRepository extends SqlRepository<LessonProgressRecord> {
  constructor() { super(LessonProgressModel); }
}

export const progressRepository = new ProgressRepository();
