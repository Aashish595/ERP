import { CrudService } from "../core/base.service.js";
import type { SubmissionRecord } from "../models/submission.model.js";
import { submissionRepository } from "../repositories/submission.repository.js";

export class SubmissionService extends CrudService<SubmissionRecord> {}
export const submissionService = new SubmissionService(submissionRepository);
