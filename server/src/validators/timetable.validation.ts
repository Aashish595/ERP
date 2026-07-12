import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { TimetableEntryModel } from "../models/timetable.model.js";

export const createTimetableSchema = createPayloadSchema(TimetableEntryModel);
export const updateTimetableSchema = createUpdateSchema(TimetableEntryModel);
