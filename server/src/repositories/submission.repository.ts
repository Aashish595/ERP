import { SqlRepository } from "../core/base.repository.js";
import { SubmissionModel, type SubmissionRecord } from "../models/submission.model.js";

export class SubmissionRepository extends SqlRepository<SubmissionRecord> {
  constructor() { super(SubmissionModel); }
}

export const submissionRepository = new SubmissionRepository();
