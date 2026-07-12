import { SqlRepository } from "../core/base.repository.js";
import { ChatSessionModel, type ChatSessionRecord } from "../models/chats.model.js";

export class ChatRepository extends SqlRepository<ChatSessionRecord> {
  constructor() { super(ChatSessionModel); }
}

export const chatRepository = new ChatRepository();
