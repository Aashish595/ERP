import { createPayloadSchema, createUpdateSchema } from "../core/model.validation.js";
import { NoticeModel } from "../models/notice.model.js";

export const createNoticeSchema = createPayloadSchema(NoticeModel);
export const updateNoticeSchema = createUpdateSchema(NoticeModel);
