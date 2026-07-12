import { SqlRepository } from "../core/base.repository.js";
import { HomeworkAssignmentModel, type HomeworkAssignmentRecord } from "../models/homework.model.js";

export class HomeworkRepository extends SqlRepository<HomeworkAssignmentRecord> {
  constructor() { super(HomeworkAssignmentModel); }
}

export const homeworkRepository = new HomeworkRepository();
