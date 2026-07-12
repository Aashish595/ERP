import { SqlRepository } from "../core/base.repository.js";
import { MeetingModel, type MeetingRecord } from "../models/meeting.model.js";

export class MeetingRepository extends SqlRepository<MeetingRecord> {
  constructor() { super(MeetingModel); }
}

export const meetingRepository = new MeetingRepository();
