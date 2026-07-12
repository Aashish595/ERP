import { CrudService } from "../core/base.service.js";
import type { ChatSessionRecord } from "../models/chats.model.js";
import { chatRepository } from "../repositories/chat.repository.js";

export class ChatService extends CrudService<ChatSessionRecord> {}
export const chatService = new ChatService(chatRepository);
