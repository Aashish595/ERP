import { CrudService } from "../core/base.service.js";
import type { StudentAttendanceRecord } from "../models/attendance.model.js";
import { attendanceRepository } from "../repositories/attendance.repository.js";

export class AttendanceService extends CrudService<StudentAttendanceRecord> {}
export const attendanceService = new AttendanceService(attendanceRepository);
