import { SqlRepository } from "../core/base.repository.js";
import { ExamModel, type ExamRecord } from "../models/exam.model.js";

export class ExamRepository extends SqlRepository<ExamRecord> {
  constructor() { super(ExamModel); }
}

export const examRepository = new ExamRepository();
