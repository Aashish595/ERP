import { CrudService } from "../core/base.service.js";
import type { TimetableEntryRecord } from "../models/timetable.model.js";
import { timetableRepository } from "../repositories/timetable.repository.js";

export class TimetableService extends CrudService<TimetableEntryRecord> {}
export const timetableService = new TimetableService(timetableRepository);
