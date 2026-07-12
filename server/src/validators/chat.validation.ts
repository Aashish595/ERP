import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { ChatSessionModel } from "../models/chats.model.js";

export const createChatSchema = createPayloadSchema(ChatSessionModel);
export const updateChatSchema = createUpdateSchema(ChatSessionModel);
