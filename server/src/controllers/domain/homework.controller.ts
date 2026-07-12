import { CrudController } from "../../core/base.controller.js";
import type { HomeworkAssignmentRecord } from "../../models/homework.model.js";
import { homeworkService } from "../../services/homework.service.js";

export class HomeworkController extends CrudController<HomeworkAssignmentRecord> {}
export const homeworkController = new HomeworkController(homeworkService);
