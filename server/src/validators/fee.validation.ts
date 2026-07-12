import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { FeeCategoryModel } from "../models/fee.model.js";

export const createFeeSchema = createPayloadSchema(FeeCategoryModel);
export const updateFeeSchema = createUpdateSchema(FeeCategoryModel);
