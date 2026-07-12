import { CrudController } from "../../core/base.controller.js";
import type { SubmissionRecord } from "../../models/submission.model.js";
import { submissionService } from "../../services/submission.service.js";

export class SubmissionController extends CrudController<SubmissionRecord> {}
export const submissionController = new SubmissionController(submissionService);
