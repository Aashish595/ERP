import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { StudentModel } from "../models/people.model.js";

export const createPeopleSchema = createPayloadSchema(StudentModel);
export const updatePeopleSchema = createUpdateSchema(StudentModel);
