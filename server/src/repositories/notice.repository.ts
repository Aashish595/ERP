import { SqlRepository } from "../core/base.repository.js";
import { NoticeModel, type NoticeRecord } from "../models/notice.model.js";

export class NoticeRepository extends SqlRepository<NoticeRecord> {
  constructor() { super(NoticeModel); }
}

export const noticeRepository = new NoticeRepository();
