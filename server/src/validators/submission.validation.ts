import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { SubmissionModel } from "../models/submission.model.js";

export const createSubmissionSchema = createPayloadSchema(SubmissionModel);
export const updateSubmissionSchema = createUpdateSchema(SubmissionModel);
