import { CrudService } from "../core/base.service.js";
import type { ExamRecord } from "../models/exam.model.js";
import { examRepository } from "../repositories/exam.repository.js";

export class ExamService extends CrudService<ExamRecord> {}
export const examService = new ExamService(examRepository);
