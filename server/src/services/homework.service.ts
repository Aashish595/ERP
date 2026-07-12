import { CrudService } from "../core/base.service.js";
import type { HomeworkAssignmentRecord } from "../models/homework.model.js";
import { homeworkRepository } from "../repositories/homework.repository.js";

export class HomeworkService extends CrudService<HomeworkAssignmentRecord> {}
export const homeworkService = new HomeworkService(homeworkRepository);
