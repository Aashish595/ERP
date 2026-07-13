import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { allowRoles, requireAuth, schoolId } from "../auth.js";
import { query } from "../db.js";
import { ApiError } from "../errors.js";
import { meetingProviderService } from "../services/meeting-provider.service.js";
import type { AuthenticatedRequest, AuthUser } from "../types.js";

type MeetingStatus = "scheduled" | "live" | "ended";
type MeetingType = "teacher_class" | "admin_teachers";

interface MeetingRow {
  id: number;
  school_id: number;
  bbb_meeting_id: string | null;
  attendee_password: string | null;
  moderator_password: string | null;
  title: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  created_by_user_id: number;
  class_id: number | null;
  section_id: number | null;
  section_name: string | null;
  teacher_id: number | null;
  record: boolean;
  recording_url: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

const adminRoles = ["SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"] as const;
const moderatorRoles = [...adminRoles, "TEACHER"] as const;
const isAdmin = (user: AuthUser) => adminRoles.includes(user.role as (typeof adminRoles)[number]);
const isModerator = (user: AuthUser) => moderatorRoles.includes(user.role as (typeof moderatorRoles)[number]);
const staff = allowRoles(...moderatorRoles);
const admin = allowRoles(...adminRoles);

function positiveInt(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ApiError(422, `${label} must be a positive integer`);
  return parsed;
}

function nonEmptyTitle(value: unknown) {
  const title = String(value ?? "").trim();
  if (!title || title.length > 255) throw new ApiError(422, "Meeting title must contain 1 to 255 characters");
  return title;
}

function visibilityScope(user: AuthUser, sid: number) {
  const values: unknown[] = [sid];
  if (isAdmin(user)) return { sql: "m.school_id=$1", values };
  values.push(user.id);
  if (user.role === "TEACHER") {
    return {
      sql: `m.school_id=$1 AND (
        m.created_by_user_id=$2 OR m.meeting_type='admin_teachers' OR
        m.teacher_id=(SELECT id FROM teachers WHERE school_id=$1 AND user_id=$2 LIMIT 1)
      )`,
      values,
    };
  }
  if (user.role === "STUDENT") {
    return {
      sql: `m.school_id=$1 AND m.meeting_type='teacher_class' AND EXISTS (
        SELECT 1 FROM students audience
        WHERE audience.school_id=$1 AND audience.user_id=$2 AND audience.is_active=true
          AND audience.class_id=m.class_id
          AND (m.section_id IS NULL OR audience.section_id=m.section_id)
      )`,
      values,
    };
  }
  return {
    sql: `m.school_id=$1 AND m.meeting_type='teacher_class' AND EXISTS (
      SELECT 1 FROM parent_guardians guardian
      JOIN students audience ON audience.guardian_id=guardian.id AND audience.is_active=true
      WHERE guardian.school_id=$1 AND guardian.user_id=$2
        AND audience.class_id=m.class_id
        AND (m.section_id IS NULL OR audience.section_id=m.section_id)
    )`,
    values,
  };
}

async function findVisibleMeeting(req: Request, meetingId: number) {
  const authReq = req as AuthenticatedRequest;
  const scope = visibilityScope(authReq.user, schoolId(req));
  scope.values.push(meetingId);
  const result = await query<MeetingRow>(
    `SELECT m.* FROM meetings m WHERE ${scope.sql} AND m.id=$${scope.values.length} LIMIT 1`,
    scope.values,
  );
  if (!result.rows[0]) throw new ApiError(404, "Meeting not found");
  return result.rows[0];
}

async function findManageableMeeting(req: Request, meetingId: number) {
  const meeting = await findVisibleMeeting(req, meetingId);
  const user = (req as AuthenticatedRequest).user;
  if (!isAdmin(user) && meeting.created_by_user_id !== user.id) {
    throw new ApiError(403, "Only the meeting creator or a school administrator can manage this meeting");
  }
  return meeting;
}

async function teacherProfile(user: AuthUser, sid: number) {
  if (user.role !== "TEACHER") return null;
  const teacher = (await query<{ id: number }>(
    "SELECT id FROM teachers WHERE school_id=$1 AND user_id=$2 AND is_active=true LIMIT 1",
    [sid, user.id],
  )).rows[0];
  if (!teacher) throw new ApiError(403, "No active teacher profile is linked to this account");
  return teacher;
}

async function classTarget(req: Request, classId: number, sectionId: number | null) {
  const user = (req as AuthenticatedRequest).user;
  const sid = schoolId(req);
  const teacher = await teacherProfile(user, sid);
  const values: unknown[] = [sid, classId, sectionId];
  let permission = "";
  if (teacher) {
    values.push(teacher.id);
    permission = ` AND (
      EXISTS (SELECT 1 FROM class_teacher_assignments a
        WHERE a.school_id=$1 AND a.class_id=$2 AND a.teacher_id=$4
          AND ($3::integer IS NULL OR a.section_id IS NULL OR a.section_id=$3))
      OR EXISTS (SELECT 1 FROM teacher_subjects a
        WHERE a.school_id=$1 AND a.class_id=$2 AND a.teacher_id=$4
          AND ($3::integer IS NULL OR a.section_id IS NULL OR a.section_id=$3))
    )`;
  }
  const target = (await query<{
    class_name: string;
    section_id: number | null;
    section_name: string | null;
  }>(
    `SELECT c.name class_name,s.id section_id,s.name section_name
     FROM school_classes c
     LEFT JOIN sections s ON s.class_id=c.id AND s.school_id=c.school_id AND s.id=$3
     WHERE c.school_id=$1 AND c.id=$2 AND c.is_active=true
       AND ($3::integer IS NULL OR s.id IS NOT NULL)${permission}
     LIMIT 1`,
    values,
  )).rows[0];
  if (!target) throw new ApiError(403, "The selected class or section is not assigned to this account");
  return { ...target, teacherId: teacher?.id ?? null };
}

async function notifyAudience(meeting: MeetingRow, action: "scheduled" | "live" | "cancelled") {
  const when = meeting.scheduled_at ? ` for ${new Date(meeting.scheduled_at).toLocaleString("en-IN")}` : "";
  const title = action === "cancelled" ? "Meeting cancelled" : action === "live" ? "Meeting is live" : "Meeting scheduled";
  const message = `${meeting.title}${when}`;
  if (meeting.meeting_type === "admin_teachers") {
    await query(
      `INSERT INTO in_app_notifications(school_id,created_by,target_role,title,message,category,priority,link)
       VALUES($1,$2,'TEACHER',$3,$4,'MEETING',$5,'/teachers/meetings')`,
      [meeting.school_id, meeting.created_by_user_id, title, message, action === "live" ? "HIGH" : "NORMAL"],
    );
    return;
  }
  await query(
    `INSERT INTO in_app_notifications(school_id,created_by,target_user_id,title,message,category,priority,link)
     SELECT $1,$2,s.user_id,$3,$4,'MEETING',$5,'/students/meetings'
     FROM students s
     WHERE s.school_id=$1 AND s.class_id=$6 AND s.is_active=true AND s.user_id IS NOT NULL
       AND ($7::integer IS NULL OR s.section_id=$7)`,
    [meeting.school_id, meeting.created_by_user_id, title, message, action === "live" ? "HIGH" : "NORMAL", meeting.class_id, meeting.section_id],
  );
}

async function createRecord(req: Request, meetingType: MeetingType, live: boolean) {
  const authReq = req as AuthenticatedRequest;
  const sid = schoolId(req);
  const title = nonEmptyTitle(req.body?.title);
  const record = req.body?.record !== false;
  let classId: number | null = null;
  let sectionId: number | null = null;
  let sectionName: string | null = null;
  let teacherId: number | null = null;

  if (meetingType === "teacher_class") {
    classId = positiveInt(req.body?.class_id, "class_id");
    sectionId = req.body?.section_id == null ? null : positiveInt(req.body.section_id, "section_id");
    const target = await classTarget(req, classId, sectionId);
    sectionId = target.section_id;
    sectionName = target.section_name;
    teacherId = target.teacherId;
  }

  let scheduledAt: Date | null = null;
  if (!live) {
    scheduledAt = new Date(String(req.body?.scheduled_at ?? ""));
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      throw new ApiError(422, "scheduled_at must be a valid future date and time");
    }
  }

  const bbbMeetingId = live ? `erp-${sid}-${Date.now()}-${randomBytes(4).toString("hex")}` : null;
  const attendeePassword = live ? randomBytes(12).toString("base64url") : null;
  const moderatorPassword = live ? randomBytes(16).toString("base64url") : null;
  if (live) {
    await meetingProviderService.createMeeting({
      meetingId: bbbMeetingId!,
      title,
      attendeePassword: attendeePassword!,
      moderatorPassword: moderatorPassword!,
      record,
    });
  }

  let meeting: MeetingRow;
  try {
    meeting = (await query<MeetingRow>(
      `INSERT INTO meetings(
        school_id,bbb_meeting_id,attendee_password,moderator_password,title,meeting_type,status,
        created_by_user_id,class_id,section_id,section_name,teacher_id,record,scheduled_at,started_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [sid, bbbMeetingId, attendeePassword, moderatorPassword, title, meetingType, live ? "live" : "scheduled",
        authReq.user.id, classId, sectionId, sectionName, teacherId, record, scheduledAt, live ? new Date() : null],
    )).rows[0]!;
  } catch (error) {
    if (live && bbbMeetingId && moderatorPassword) {
      await meetingProviderService.endMeeting(bbbMeetingId, moderatorPassword).catch(() => undefined);
    }
    throw error;
  }

  await notifyAudience(meeting, live ? "live" : "scheduled").catch(() => undefined);
  if (!live) return meeting;
  return {
    meeting_id: meeting.id,
    join_url: meetingProviderService.joinUrl({
      name: authReq.user.full_name,
      userId: authReq.user.id,
      meetingId: meeting.bbb_meeting_id!,
      password: meeting.moderator_password!,
      isModerator: true,
    }),
  };
}

export const meetingsRouter = Router();

meetingsRouter.use("/meetings", requireAuth);

meetingsRouter.get("/meetings/stats", staff, async (req, res) => {
  const result = await query<{
    total_meetings: number;
    live_now: number;
    total_ended: number;
    recorded: number;
  }>(
    `SELECT COUNT(*)::int total_meetings,
      COUNT(*) FILTER(WHERE status='live')::int live_now,
      COUNT(*) FILTER(WHERE status='ended')::int total_ended,
      COUNT(*) FILTER(WHERE recording_url IS NOT NULL)::int recorded
     FROM meetings WHERE school_id=$1`,
    [schoolId(req)],
  );
  res.json(result.rows[0]);
});

meetingsRouter.get("/meetings/active/class/:classId", async (req, res) => {
  const classId = positiveInt(req.params.classId, "classId");
  const user = (req as AuthenticatedRequest).user;
  const scope = visibilityScope(user, schoolId(req));
  scope.values.push(classId);
  const meeting = (await query(
    `SELECT m.* FROM meetings m WHERE ${scope.sql} AND m.class_id=$${scope.values.length} AND m.status='live'
     ORDER BY m.started_at DESC LIMIT 1`,
    scope.values,
  )).rows[0] ?? null;
  res.json(meeting);
});

meetingsRouter.get("/meetings/teacher/my-classes", staff, async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const sid = schoolId(req);
  if (isAdmin(user)) {
    const classes = await query(
      `SELECT c.id class_id,s.id section_id,c.name class_name,s.name section_name
       FROM school_classes c LEFT JOIN sections s ON s.class_id=c.id AND s.school_id=c.school_id AND s.is_active=true
       WHERE c.school_id=$1 AND c.is_active=true ORDER BY c.name,s.name`,
      [sid],
    );
    res.json({ classes: classes.rows });
    return;
  }
  const classes = await query(
    `SELECT DISTINCT c.id class_id,s.id section_id,c.name class_name,s.name section_name
     FROM teachers t
     JOIN (
       SELECT teacher_id,class_id,section_id FROM class_teacher_assignments WHERE school_id=$1
       UNION SELECT teacher_id,class_id,section_id FROM teacher_subjects WHERE school_id=$1
     ) a ON a.teacher_id=t.id
     JOIN school_classes c ON c.id=a.class_id AND c.school_id=$1 AND c.is_active=true
     LEFT JOIN sections s ON s.class_id=c.id AND s.school_id=$1 AND s.is_active=true
       AND (a.section_id IS NULL OR s.id=a.section_id)
     WHERE t.school_id=$1 AND t.user_id=$2 AND t.is_active=true
     ORDER BY c.name,s.name`,
    [sid, user.id],
  );
  res.json({ classes: classes.rows });
});

meetingsRouter.get("/meetings/class/:classId/students", staff, async (req, res) => {
  const classId = positiveInt(req.params.classId, "classId");
  const sectionId = req.query.section_id == null ? null : positiveInt(req.query.section_id, "section_id");
  await classTarget(req, classId, sectionId);
  const values: unknown[] = [schoolId(req), classId];
  let sectionFilter = "";
  if (sectionId) {
    values.push(sectionId);
    sectionFilter = ` AND s.section_id=$${values.length}`;
  }
  const students = await query(
    `SELECT s.id,concat_ws(' ',s.first_name,s.last_name) full_name,s.admission_no,s.roll_number
     FROM students s WHERE s.school_id=$1 AND s.class_id=$2 AND s.is_active=true${sectionFilter}
     ORDER BY s.first_name,s.last_name`,
    values,
  );
  res.json(students.rows);
});

meetingsRouter.get("/meetings/", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const scope = visibilityScope(authReq.user, schoolId(req));
  const conditions = [scope.sql];
  const status = req.query.status == null ? null : String(req.query.status);
  if (status && !["scheduled", "live", "ended"].includes(status)) throw new ApiError(422, "Invalid meeting status");
  if (status) {
    scope.values.push(status);
    conditions.push(`m.status=$${scope.values.length}`);
  }
  const type = req.query.meeting_type == null ? null : String(req.query.meeting_type);
  if (type && !["teacher_class", "admin_teachers"].includes(type)) throw new ApiError(422, "Invalid meeting type");
  if (type) {
    scope.values.push(type);
    conditions.push(`m.meeting_type=$${scope.values.length}`);
  }
  const search = String(req.query.search ?? "").trim();
  if (search) {
    scope.values.push(`%${search}%`);
    conditions.push(`m.title ILIKE $${scope.values.length}`);
  }
  const skip = Math.max(0, Number.parseInt(String(req.query.skip ?? 0), 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? 20), 10) || 20));
  const where = conditions.join(" AND ");
  const total = (await query<{ total: number }>(`SELECT COUNT(*)::int total FROM meetings m WHERE ${where}`, scope.values)).rows[0]?.total ?? 0;
  scope.values.push(limit, skip);
  const items = await query(
    `SELECT m.*,c.name class_name,COALESCE(s.name,m.section_name) section_name,t.full_name teacher_name,
      CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id',u.id,'full_name',u.full_name,'role',u.role) END created_by
     FROM meetings m
     LEFT JOIN school_classes c ON c.id=m.class_id
     LEFT JOIN sections s ON s.id=m.section_id
     LEFT JOIN teachers t ON t.id=m.teacher_id
     LEFT JOIN users u ON u.id=m.created_by_user_id
     WHERE ${where}
     ORDER BY COALESCE(m.scheduled_at,m.started_at,m.created_at) DESC
     LIMIT $${scope.values.length - 1} OFFSET $${scope.values.length}`,
    scope.values,
  );
  res.json({ items: items.rows, total });
});

meetingsRouter.post("/meetings/teacher/class", staff, async (req, res) => {
  res.status(201).json(await createRecord(req, "teacher_class", true));
});

meetingsRouter.post("/meetings/admin/teachers", admin, async (req, res) => {
  res.status(201).json(await createRecord(req, "admin_teachers", true));
});

meetingsRouter.post("/meetings/teacher/class/schedule", staff, async (req, res) => {
  res.status(201).json(await createRecord(req, "teacher_class", false));
});

meetingsRouter.post("/meetings/admin/teachers/schedule", admin, async (req, res) => {
  res.status(201).json(await createRecord(req, "admin_teachers", false));
});

meetingsRouter.post("/meetings/:id/start", staff, async (req, res) => {
  const meeting = await findManageableMeeting(req, positiveInt(req.params.id, "meeting id"));
  if (meeting.status !== "scheduled") throw new ApiError(409, "Only a scheduled meeting can be started");
  const bbbMeetingId = `erp-${meeting.school_id}-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const attendeePassword = randomBytes(12).toString("base64url");
  const moderatorPassword = randomBytes(16).toString("base64url");
  await meetingProviderService.createMeeting({
    meetingId: bbbMeetingId,
    title: meeting.title,
    attendeePassword,
    moderatorPassword,
    record: meeting.record,
  });
  const updated = (await query<MeetingRow>(
    `UPDATE meetings SET status='live',bbb_meeting_id=$1,attendee_password=$2,moderator_password=$3,started_at=NOW()
     WHERE id=$4 AND school_id=$5 AND status='scheduled' RETURNING *`,
    [bbbMeetingId, attendeePassword, moderatorPassword, meeting.id, meeting.school_id],
  )).rows[0];
  if (!updated) {
    await meetingProviderService.endMeeting(bbbMeetingId, moderatorPassword).catch(() => undefined);
    throw new ApiError(409, "Meeting status changed before it could be started");
  }
  await notifyAudience(updated, "live").catch(() => undefined);
  const user = (req as AuthenticatedRequest).user;
  res.json({
    meeting_id: updated.id,
    join_url: meetingProviderService.joinUrl({
      name: user.full_name,
      userId: user.id,
      meetingId: bbbMeetingId,
      password: moderatorPassword,
      isModerator: true,
    }),
  });
});

meetingsRouter.delete("/meetings/:id/cancel", staff, async (req, res) => {
  const meeting = await findManageableMeeting(req, positiveInt(req.params.id, "meeting id"));
  if (meeting.status !== "scheduled") throw new ApiError(409, "Only a scheduled meeting can be cancelled");
  const deleted = await query("DELETE FROM meetings WHERE id=$1 AND school_id=$2 AND status='scheduled'", [meeting.id, meeting.school_id]);
  if (!deleted.rowCount) throw new ApiError(409, "Meeting status changed before it could be cancelled");
  await notifyAudience(meeting, "cancelled").catch(() => undefined);
  res.json({ message: "Meeting cancelled", meeting_id: meeting.id });
});

meetingsRouter.get("/meetings/:id/join", async (req, res) => {
  const meeting = await findVisibleMeeting(req, positiveInt(req.params.id, "meeting id"));
  if (meeting.status !== "live" || !meeting.bbb_meeting_id) throw new ApiError(409, "This meeting is not live");
  if (!(await meetingProviderService.isMeetingRunning(meeting.bbb_meeting_id))) {
    await query("UPDATE meetings SET status='ended',ended_at=COALESCE(ended_at,NOW()) WHERE id=$1 AND school_id=$2", [meeting.id, meeting.school_id]);
    throw new ApiError(409, "This meeting has already ended");
  }
  const user = (req as AuthenticatedRequest).user;
  const moderator = isAdmin(user) || meeting.created_by_user_id === user.id;
  const password = moderator ? meeting.moderator_password : meeting.attendee_password;
  if (!password) throw new ApiError(409, "Meeting credentials are unavailable");
  const joinUrl = meetingProviderService.joinUrl({
    name: user.full_name,
    userId: user.id,
    meetingId: meeting.bbb_meeting_id,
    password,
    isModerator: moderator,
  });
  await query(
    `INSERT INTO meeting_attendance(meeting_id,school_id,user_id,role)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(meeting_id,user_id) DO UPDATE SET last_joined_at=NOW(),join_count=meeting_attendance.join_count+1`,
    [meeting.id, meeting.school_id, user.id, user.role],
  );
  res.json({ join_url: joinUrl });
});

meetingsRouter.post("/meetings/:id/end", staff, async (req, res) => {
  const meeting = await findManageableMeeting(req, positiveInt(req.params.id, "meeting id"));
  if (meeting.status !== "live" || !meeting.bbb_meeting_id || !meeting.moderator_password) {
    throw new ApiError(409, "This meeting is not live");
  }
  if (await meetingProviderService.isMeetingRunning(meeting.bbb_meeting_id)) {
    await meetingProviderService.endMeeting(meeting.bbb_meeting_id, meeting.moderator_password);
  }
  await query("UPDATE meetings SET status='ended',ended_at=NOW() WHERE id=$1 AND school_id=$2", [meeting.id, meeting.school_id]);
  res.json({ message: "Meeting ended", meeting_id: meeting.id });
});

meetingsRouter.post("/meetings/:id/recording/fetch", staff, async (req, res) => {
  const meeting = await findVisibleMeeting(req, positiveInt(req.params.id, "meeting id"));
  if (!meeting.record || !meeting.bbb_meeting_id) return res.json({ ready: false, recording_url: null });
  if (meeting.recording_url) return res.json({ ready: true, recording_url: meeting.recording_url });
  const recordingUrl = await meetingProviderService.getRecordingUrl(meeting.bbb_meeting_id);
  if (recordingUrl) {
    await query("UPDATE meetings SET recording_url=$1 WHERE id=$2 AND school_id=$3", [recordingUrl, meeting.id, meeting.school_id]);
  }
  res.json({ ready: Boolean(recordingUrl), recording_url: recordingUrl });
});

meetingsRouter.get("/meetings/:id/attendance", staff, async (req, res) => {
  const meeting = await findManageableMeeting(req, positiveInt(req.params.id, "meeting id"));
  const attendance = await query(
    `SELECT a.user_id,u.full_name,a.role,a.first_joined_at,a.last_joined_at,a.join_count
     FROM meeting_attendance a JOIN users u ON u.id=a.user_id
     WHERE a.meeting_id=$1 AND a.school_id=$2 ORDER BY a.first_joined_at`,
    [meeting.id, meeting.school_id],
  );
  res.json({ meeting_id: meeting.id, total: attendance.rowCount ?? 0, items: attendance.rows });
});
