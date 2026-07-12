import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { UserModel } from "../models/user.model.js";

export const createProfileSchema = createPayloadSchema(UserModel);
export const updateProfileSchema = createUpdateSchema(UserModel);
