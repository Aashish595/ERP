import { CrudController } from "../../core/base.controller.js";
import type { MeetingRecord } from "../../models/meeting.model.js";
import { meetingService } from "../../services/meeting.service.js";

export class MeetingController extends CrudController<MeetingRecord> {}
export const meetingController = new MeetingController(meetingService);
