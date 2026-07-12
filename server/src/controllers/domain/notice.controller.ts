import { CrudController } from "../../core/base.controller.js";
import type { NoticeRecord } from "../../models/notice.model.js";
import { noticeService } from "../../services/notice.service.js";

export class NoticeController extends CrudController<NoticeRecord> {}
export const noticeController = new NoticeController(noticeService);
