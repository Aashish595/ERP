import { CrudController } from "../../core/base.controller.js";
import type { ExamRecord } from "../../models/exam.model.js";
import { examService } from "../../services/exam.service.js";

export class ExamController extends CrudController<ExamRecord> {}
export const examController = new ExamController(examService);
