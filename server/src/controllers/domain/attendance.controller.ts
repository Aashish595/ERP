import { CrudController } from "../../core/base.controller.js";
import type { StudentAttendanceRecord } from "../../models/attendance.model.js";
import { attendanceService } from "../../services/attendance.service.js";

export class AttendanceController extends CrudController<StudentAttendanceRecord> {}
export const attendanceController = new AttendanceController(attendanceService);
