import { CrudController } from "../../core/base.controller.js";
import type { TimetableEntryRecord } from "../../models/timetable.model.js";
import { timetableService } from "../../services/timetable.service.js";

export class TimetableController extends CrudController<TimetableEntryRecord> {}
export const timetableController = new TimetableController(timetableService);
