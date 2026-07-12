import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { AnnouncementModel } from "../models/communication.model.js";

export const createCommunicationSchema = createPayloadSchema(AnnouncementModel);
export const updateCommunicationSchema = createUpdateSchema(AnnouncementModel);
