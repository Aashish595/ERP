import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { BookModel } from "../models/library.model.js";

export const createLibrarySchema = createPayloadSchema(BookModel);
export const updateLibrarySchema = createUpdateSchema(BookModel);
