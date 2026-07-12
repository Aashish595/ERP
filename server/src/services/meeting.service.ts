import { CrudService } from "../core/base.service.js";
import type { MeetingRecord } from "../models/meeting.model.js";
import { meetingRepository } from "../repositories/meeting.repository.js";

export class MeetingService extends CrudService<MeetingRecord> {}
export const meetingService = new MeetingService(meetingRepository);
