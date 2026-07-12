import { CrudService } from "../core/base.service.js";
import type { NoticeRecord } from "../models/notice.model.js";
import { noticeRepository } from "../repositories/notice.repository.js";

export class NoticeService extends CrudService<NoticeRecord> {}
export const noticeService = new NoticeService(noticeRepository);
