import { CrudController } from "../../core/base.controller.js";
import type { ChatSessionRecord } from "../../models/chats.model.js";
import { chatService } from "../../services/chat.service.js";

export class ChatController extends CrudController<ChatSessionRecord> {}
export const chatController = new ChatController(chatService);
