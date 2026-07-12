import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { MeetingModel } from "../models/meeting.model.js";

export const createMeetingSchema = createPayloadSchema(MeetingModel);
export const updateMeetingSchema = createUpdateSchema(MeetingModel);
