import { Router } from "express";
import { activeAcademicSessionId, allowRoles, requireAuth, schoolId } from "../auth.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import { upload } from "../uploads.js";
import { uploadService } from "../services/upload.service.js";
import type { AuthenticatedRequest } from "../types.js";

export const learningRouter=Router();learningRouter.use(requireAuth);
const storeUpload = uploadService.store.bind(uploadService);
const staff=allowRoles("SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN","TEACHER");
const admin=allowRoles("SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN");

const timetableConfigs = {
  periods: { table: "timetable_periods", fields: ["period_number", "name", "start_time", "end_time", "is_break", "is_active"] },
  days: { table: "timetable_days", fields: ["day_of_week", "display_name", "sort_order", "is_active"] },
  entries: { table: "timetable_entries", fields: ["academic_session_id", "class_id", "section_id", "section_name", "day_id", "period_id", "subject_id", "teacher_id", "room", "note", "is_active"] },
} as const;

async function timetableEntries(req: import("express").Request) {
  const values: unknown[] = [schoolId(req)];
  const conditions = ["e.school_id=$1"];
  const selectedSessionId = req.query.academic_session_id
    ? requiredPositiveId(req.query.academic_session_id, "Academic session")
    : await activeAcademicSessionId(req);
  if (selectedSessionId) {
    values.push(selectedSessionId);
    conditions.push(`e.academic_session_id=$${values.length}`);
  }
  for (const field of ["class_id", "section_id", "day_id", "period_id", "subject_id", "teacher_id", "is_active"] as const) {
    if (req.query[field] === undefined || req.query[field] === "") continue;
    values.push(req.query[field]);
    conditions.push(`e.${field}=$${values.length}`);
  }
  return (await query<any>(
    `SELECT e.*,d.day_of_week,d.display_name day_name,d.sort_order day_sort_order,
            p.period_number,p.name period_name,p.start_time,p.end_time,p.is_break,
            sub.name subject_name,t.full_name teacher_name,c.name class_name,
            COALESCE(se.name,e.section_name) section_name,ses.name academic_session_name
       FROM timetable_entries e
       JOIN timetable_days d ON d.id=e.day_id
       JOIN timetable_periods p ON p.id=e.period_id
       JOIN school_classes c ON c.id=e.class_id
       LEFT JOIN sections se ON se.id=e.section_id
       LEFT JOIN subjects sub ON sub.id=e.subject_id
       LEFT JOIN teachers t ON t.id=e.teacher_id
       LEFT JOIN academic_sessions ses ON ses.id=e.academic_session_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.sort_order,p.period_number,e.id`,
    values,
  )).rows;
}

for (const [path, cfg] of Object.entries(timetableConfigs)) {
  learningRouter.get(`/timetable/${path}`, async (req, res) => {
    if (path === "entries") return res.json(await timetableEntries(req));
    const conditions = ["school_id=$1"];
    const values: unknown[] = [schoolId(req)];
    for (const field of cfg.fields) {
      if (req.query[field] === undefined || req.query[field] === "") continue;
      values.push(req.query[field]);
      conditions.push(`${field}=$${values.length}`);
    }
    const order = path === "days" ? "sort_order" : "period_number";
    res.json((await query(`SELECT * FROM ${cfg.table} WHERE ${conditions.join(" AND ")} ORDER BY ${order}`, values)).rows);
  });
  learningRouter.post(`/timetable/${path}`, admin, async (req, res) => {
    const data: any = { ...req.body };
    if (path === "entries" && !data.academic_session_id) data.academic_session_id = await activeAcademicSessionId(req);
    const columns = cfg.fields.filter((field) => data[field] !== undefined);
    const result = await query(
      `INSERT INTO ${cfg.table}(school_id,${columns.join(",")}) VALUES($1,${columns.map((_, index) => `$${index + 2}`).join(",")}) RETURNING *`,
      [schoolId(req), ...columns.map((field) => data[field])],
    );
    res.status(201).json(result.rows[0]);
  });
  learningRouter.put(`/timetable/${path}/:id`, admin, async (req, res) => {
    const columns = cfg.fields.filter((field) => req.body[field] !== undefined);
    if (!columns.length) throw new ApiError(422, "No valid fields supplied");
    const result = await query(
      `UPDATE ${cfg.table} SET ${columns.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=NOW()
        WHERE id=$${columns.length + 1} AND school_id=$${columns.length + 2} RETURNING *`,
      [...columns.map((field) => req.body[field]), Number(req.params.id), schoolId(req)],
    );
    if (!result.rows[0]) throw new ApiError(404, "Record not found");
    res.json(result.rows[0]);
  });
  learningRouter.delete(`/timetable/${path}/:id`, admin, async (req, res) => {
    const result = await query(`DELETE FROM ${cfg.table} WHERE id=$1 AND school_id=$2 RETURNING id`, [Number(req.params.id), schoolId(req)]);
    if (!result.rowCount) throw new ApiError(404, "Record not found");
    res.json({ message: "Deleted successfully" });
  });
}

learningRouter.get("/timetable/meta", async (req, res) => {
  const sid = schoolId(req);
  const sessionId = await activeAcademicSessionId(req);
  const [periods, days, classes, sections, subjects, teachers, sessions] = await Promise.all([
    query("SELECT * FROM timetable_periods WHERE school_id=$1 ORDER BY period_number", [sid]),
    query("SELECT * FROM timetable_days WHERE school_id=$1 ORDER BY sort_order", [sid]),
    query("SELECT id,name FROM school_classes WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY name", [sid, sessionId]),
    query("SELECT id,name,class_id::text extra FROM sections WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY name", [sid, sessionId]),
    query("SELECT id,name,class_id::text extra FROM subjects WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY name", [sid, sessionId]),
    query("SELECT id,full_name name FROM teachers WHERE school_id=$1 AND is_active=true AND ($2::int IS NULL OR academic_session_id=$2) ORDER BY full_name", [sid, sessionId]),
    query("SELECT id,name,CASE WHEN is_active THEN 'active' ELSE NULL END extra FROM academic_sessions WHERE school_id=$1 ORDER BY start_date DESC,id DESC", [sid]),
  ]);
  res.json({
    periods: periods.rows,
    days: days.rows,
    classes: classes.rows,
    sections: sections.rows,
    subjects: subjects.rows,
    teachers: teachers.rows,
    academic_sessions: sessions.rows,
    current_academic_session_id: sessionId,
  });
});

async function timetableGrid(req: import("express").Request, classId: number | null, teacherId: number | null, sectionId: number | null = null) {
  const sid = schoolId(req);
  const sessionId = await activeAcademicSessionId(req);
  const [entries, periods, days, classRow, teacherRow] = await Promise.all([
    query<any>(
      `SELECT e.*,d.day_of_week,d.display_name day_name,d.sort_order day_sort_order,
              p.period_number,p.name period_name,p.start_time,p.end_time,p.is_break,
              sub.name subject_name,t.full_name teacher_name,c.name class_name,
              COALESCE(se.name,e.section_name) section_name,ses.name academic_session_name
         FROM timetable_entries e
         JOIN timetable_days d ON d.id=e.day_id
         JOIN timetable_periods p ON p.id=e.period_id
         JOIN school_classes c ON c.id=e.class_id
         LEFT JOIN sections se ON se.id=e.section_id
         LEFT JOIN subjects sub ON sub.id=e.subject_id
         LEFT JOIN teachers t ON t.id=e.teacher_id
         LEFT JOIN academic_sessions ses ON ses.id=e.academic_session_id
        WHERE e.school_id=$1 AND ($2::int IS NULL OR e.class_id=$2)
          AND ($3::int IS NULL OR e.teacher_id=$3) AND ($4::int IS NULL OR e.section_id=$4)
          AND ($5::int IS NULL OR e.academic_session_id=$5) AND e.is_active=true
        ORDER BY d.sort_order,p.period_number`,
      [sid, classId, teacherId, sectionId, sessionId],
    ),
    query("SELECT * FROM timetable_periods WHERE school_id=$1 AND is_active=true ORDER BY period_number", [sid]),
    query("SELECT * FROM timetable_days WHERE school_id=$1 AND is_active=true ORDER BY sort_order", [sid]),
    classId ? query<any>("SELECT name FROM school_classes WHERE id=$1 AND school_id=$2", [classId, sid]) : Promise.resolve({ rows: [] }),
    teacherId ? query<any>("SELECT full_name name FROM teachers WHERE id=$1 AND school_id=$2", [teacherId, sid]) : Promise.resolve({ rows: [] }),
  ]);
  const mode = teacherId ? "teacher" : "class";
  const name = teacherId ? teacherRow.rows[0]?.name : classRow.rows[0]?.name;
  return {
    mode,
    title: `${name || (mode === "teacher" ? "Teacher" : "Class")} Timetable`,
    class_id: classId,
    teacher_id: teacherId,
    entries: entries.rows,
    periods: periods.rows,
    days: days.rows,
  };
}

function requiredPositiveId(value: unknown, label: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(422, `${label} is required`);
  return id;
}

learningRouter.get("/timetable/view/class", async (req, res) => {
  const classId = requiredPositiveId(req.query.class_id, "Class");
  const sectionId = req.query.section_id ? requiredPositiveId(req.query.section_id, "Section") : null;
  res.json(await timetableGrid(req, classId, null, sectionId));
});
learningRouter.get("/timetable/view/teacher", async (req, res) => {
  res.json(await timetableGrid(req, null, requiredPositiveId(req.query.teacher_id, "Teacher")));
});
learningRouter.get("/timetable/my-teacher", async (req, res) => {
  const teacher = (await query<any>("SELECT id FROM teachers WHERE user_id=$1 AND school_id=$2", [(req as AuthenticatedRequest).user.id, schoolId(req)])).rows[0];
  res.json(teacher ? await timetableGrid(req, null, teacher.id) : { mode: "teacher", title: "My Timetable", entries: [], periods: [], days: [] });
});
learningRouter.get("/timetable/my-student", async (req, res) => {
  const student = (await query<any>("SELECT class_id,section_id FROM students WHERE user_id=$1 AND school_id=$2", [(req as AuthenticatedRequest).user.id, schoolId(req)])).rows[0];
  res.json(student ? await timetableGrid(req, student.class_id, null, student.section_id) : { mode: "class", title: "My Timetable", entries: [], periods: [], days: [] });
});
learningRouter.get("/timetable/my-children", async (req, res) => {
  const rows = await query<any>(
    "SELECT s.id,s.class_id,s.section_id,concat_ws(' ',s.first_name,s.last_name) student_name FROM parent_guardians g JOIN students s ON s.guardian_id=g.id WHERE g.user_id=$1 AND s.school_id=$2",
    [(req as AuthenticatedRequest).user.id, schoolId(req)],
  );
  res.json(await Promise.all(rows.rows.map(async (student: any) => ({ ...await timetableGrid(req, student.class_id, null, student.section_id), student_id: student.id, student_name: student.student_name }))));
});

const bookFields=["title","author","isbn","publisher","edition","category","language","shelf_location","description","cover_url","total_copies","available_copies","is_active"];
learningRouter.get("/library/categories",async(req,res)=>{const r=await query<{category:string}>("SELECT DISTINCT category FROM library_books WHERE school_id=$1 AND category IS NOT NULL ORDER BY category",[schoolId(req)]);res.json(r.rows.map(x=>x.category));});
learningRouter.get("/library/stats",staff,async(req,res)=>{const r=await query<any>(`SELECT COUNT(*)::int total_titles,COALESCE(SUM(total_copies),0)::int total_copies,COALESCE(SUM(available_copies),0)::int available_copies,(SELECT COUNT(*)::int FROM library_issues WHERE school_id=$1 AND status IN ('ISSUED','OVERDUE')) issued,(SELECT COUNT(*)::int FROM library_issues WHERE school_id=$1 AND due_date<CURRENT_DATE AND status='ISSUED') overdue FROM library_books WHERE school_id=$1`,[schoolId(req)]);res.json(r.rows[0]);});
learningRouter.get("/library/books",async(req,res)=>{const values:unknown[]=[schoolId(req)];let where="school_id=$1";if(req.query.search){values.push(`%${req.query.search}%`);where+=` AND (title ILIKE $${values.length} OR author ILIKE $${values.length} OR isbn ILIKE $${values.length})`;}if(req.query.category){values.push(req.query.category);where+=` AND category=$${values.length}`;}res.json((await query(`SELECT * FROM library_books WHERE ${where} ORDER BY title LIMIT 500`,values)).rows);});
learningRouter.get("/library/books/:id",async(req,res)=>{const row=(await query("SELECT * FROM library_books WHERE id=$1 AND school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];if(!row)throw new ApiError(404,"Book not found");res.json(row);});
learningRouter.post("/library/books",staff,async(req,res)=>{const cols=bookFields.filter(f=>req.body[f]!==undefined);const total=Number(req.body.total_copies??1);if(!cols.includes("available_copies"))req.body.available_copies=total;if(!cols.includes("total_copies"))req.body.total_copies=total;const all=bookFields.filter(f=>req.body[f]!==undefined);const r=await query(`INSERT INTO library_books(school_id,${all.join(",")}) VALUES($1,${all.map((_,i)=>`$${i+2}`).join(",")}) RETURNING *`,[schoolId(req),...all.map(f=>req.body[f])]);res.status(201).json(r.rows[0]);});
learningRouter.patch("/library/books/:id",staff,async(req,res)=>{const cols=bookFields.filter(f=>req.body[f]!==undefined);const r=await query(`UPDATE library_books SET ${cols.map((f,i)=>`${f}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${cols.length+1} AND school_id=$${cols.length+2} RETURNING *`,[...cols.map(f=>req.body[f]),Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Book not found");res.json(r.rows[0]);});
learningRouter.delete("/library/books/:id",staff,async(req,res)=>{const r=await query("UPDATE library_books SET is_active=false,updated_at=NOW() WHERE id=$1 AND school_id=$2 RETURNING id",[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Book not found");res.json({message:"Book removed"});});
learningRouter.get("/library/issues/overdue",staff,async(req,res)=>{const r=await query("SELECT i.*,b.title book_title FROM library_issues i JOIN library_books b ON b.id=i.book_id WHERE i.school_id=$1 AND i.due_date<CURRENT_DATE AND i.status='ISSUED' ORDER BY i.due_date",[schoolId(req)]);res.json(r.rows);});
learningRouter.get("/library/issues/my",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const r=await query("SELECT i.*,b.title book_title FROM library_issues i JOIN library_books b ON b.id=i.book_id LEFT JOIN students s ON s.id=i.student_id LEFT JOIN teachers t ON t.id=i.teacher_id WHERE i.school_id=$1 AND (i.issued_to_user_id=$2 OR s.user_id=$2 OR t.user_id=$2) ORDER BY i.created_at DESC",[schoolId(req),user.id]);res.json(r.rows);});
learningRouter.get("/library/issues",staff,async(req,res)=>{const r=await query("SELECT i.*,b.title book_title FROM library_issues i JOIN library_books b ON b.id=i.book_id WHERE i.school_id=$1 ORDER BY i.created_at DESC LIMIT 500",[schoolId(req)]);res.json(r.rows);});
learningRouter.get("/library/issues/:id",async(req,res)=>{const row=(await query("SELECT i.*,b.title book_title FROM library_issues i JOIN library_books b ON b.id=i.book_id WHERE i.id=$1 AND i.school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];if(!row)throw new ApiError(404,"Issue not found");res.json(row);});
learningRouter.post("/library/issues",staff,async(req,res)=>{const row=await transaction(async client=>{const locked=await client.query<any>("SELECT * FROM library_books WHERE id=$1 AND school_id=$2 FOR UPDATE",[req.body.book_id,schoolId(req)]);if(!locked.rows[0]||locked.rows[0].available_copies<1)throw new ApiError(409,"No available copy");const r=await client.query(`INSERT INTO library_issues(school_id,book_id,student_id,teacher_id,issued_to_user_id,borrower_name,issued_by,issue_date,due_date,status,fine_per_day,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ISSUED',$10,$11) RETURNING *`,[schoolId(req),req.body.book_id,req.body.student_id??null,req.body.teacher_id??null,req.body.issued_to_user_id??null,req.body.borrower_name,(req as AuthenticatedRequest).user.id,req.body.issue_date,req.body.due_date,req.body.fine_per_day??1,req.body.notes??null]);await client.query("UPDATE library_books SET available_copies=available_copies-1 WHERE id=$1",[req.body.book_id]);return r.rows[0];});res.status(201).json(row);});
learningRouter.post("/library/issues/:id/return",staff,async(req,res)=>{const row=await transaction(async client=>{const issue=(await client.query<any>("SELECT * FROM library_issues WHERE id=$1 AND school_id=$2 FOR UPDATE",[Number(req.params.id),schoolId(req)])).rows[0];if(!issue)throw new ApiError(404,"Issue not found");if(issue.status==="RETURNED")throw new ApiError(409,"Book already returned");const date=req.body.return_date??new Date().toISOString().slice(0,10);const days=Math.max(0,Math.floor((Date.parse(date)-Date.parse(issue.due_date))/86400000));const r=await client.query("UPDATE library_issues SET return_date=$1,status='RETURNED',fine_amount=$2,returned_to=$3,updated_at=NOW() WHERE id=$4 RETURNING *",[date,days*issue.fine_per_day,(req as AuthenticatedRequest).user.id,issue.id]);await client.query("UPDATE library_books SET available_copies=LEAST(total_copies,available_copies+1) WHERE id=$1",[issue.book_id]);return r.rows[0];});res.json(row);});
learningRouter.post("/library/issues/:id/pay-fine",staff,async(req,res)=>{const r=await query("UPDATE library_issues SET fine_paid=$1,updated_at=NOW() WHERE id=$2 AND school_id=$3 RETURNING *",[req.body.fine_paid??true,Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Issue not found");res.json(r.rows[0]);});

learningRouter.get("/courses/meta",staff,async(req,res)=>{const sid=schoolId(req);const [classes,sections,subjects,teachers]=await Promise.all([query("SELECT id,name FROM school_classes WHERE school_id=$1 AND is_active=true",[sid]),query("SELECT id,name,class_id FROM sections WHERE school_id=$1 AND is_active=true",[sid]),query("SELECT id,name,class_id FROM subjects WHERE school_id=$1 AND is_active=true",[sid]),query("SELECT id,full_name name,user_id FROM teachers WHERE school_id=$1 AND is_active=true",[sid])]);res.json({classes:classes.rows,sections:sections.rows,subjects:subjects.rows,teachers:teachers.rows,current_academic_session_id:await activeAcademicSessionId(req)});});
async function courseList(req:import("express").Request,mode:"all"|"student"|"parent"|"created"){
 const user=(req as AuthenticatedRequest).user;const sid=schoolId(req);
 if(mode==="student")return (await query(`SELECT DISTINCT c.*,t.full_name teacher_name,s.name subject_name FROM courses c JOIN enrollments e ON e.course_id=c.id LEFT JOIN teachers t ON t.user_id=c.teacher_id LEFT JOIN subjects s ON s.id=c.subject_id WHERE e.student_id=$1 AND c.school_id=$2 AND c.is_active=true ORDER BY c.created_at DESC`,[user.id,sid])).rows;
 if(mode==="parent")return (await query(`SELECT DISTINCT c.*,st.id student_id,concat_ws(' ',st.first_name,st.last_name) student_name FROM parent_guardians g JOIN students st ON st.guardian_id=g.id JOIN users su ON su.id=st.user_id JOIN enrollments e ON e.student_id=su.id JOIN courses c ON c.id=e.course_id WHERE g.user_id=$1 AND c.school_id=$2 AND c.is_active=true`,[user.id,sid])).rows;
 const values:unknown[]=[sid];let where="c.school_id=$1";if(mode==="created"){values.push(user.id);where+=` AND c.teacher_id=$${values.length}`;}
 return (await query(`SELECT c.*,t.full_name teacher_name,s.name subject_name,sc.name class_name,se.name section_name FROM courses c LEFT JOIN teachers t ON t.user_id=c.teacher_id LEFT JOIN subjects s ON s.id=c.subject_id LEFT JOIN school_classes sc ON sc.id=c.class_id LEFT JOIN sections se ON se.id=c.section_id WHERE ${where} ORDER BY c.created_at DESC`,values)).rows;
}
learningRouter.get("/courses/student/my",async(req,res)=>res.json(await courseList(req,"student")));
learningRouter.get("/courses/parent/children",async(req,res)=>res.json(await courseList(req,"parent")));
learningRouter.get("/courses/my-created",staff,async(req,res)=>res.json(await courseList(req,"created")));
learningRouter.get("/courses/enrolled",async(req,res)=>res.json(await courseList(req,"student")));
learningRouter.get("/courses/",async(req,res)=>res.json(await courseList(req,"all")));
learningRouter.post("/courses/",staff,upload.single("thumbnail"),async(req,res)=>{const user=(req as AuthenticatedRequest).user;const url=req.file?await storeUpload(req.file,`schools/${schoolId(req)}/courses`):null;const r=await query(`INSERT INTO courses(school_id,class_id,section_id,section_name,subject_id,academic_session_id,title,description,thumbnail_url,teacher_id,status,is_active)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[schoolId(req),req.body.class_id||null,req.body.section_id||null,req.body.section_name||null,req.body.subject_id||null,req.body.academic_session_id||await activeAcademicSessionId(req),req.body.title,req.body.description||null,url,user.id,req.body.status??"PUBLISHED",req.body.is_active!=="false"]);res.status(201).json(r.rows[0]);});
learningRouter.get("/courses/:id",async(req,res)=>{const row=(await query("SELECT * FROM courses WHERE id=$1 AND school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];if(!row)throw new ApiError(404,"Course not found");res.json(row);});
learningRouter.put("/courses/:id",staff,upload.single("thumbnail"),async(req,res)=>{const url=req.file?await storeUpload(req.file,`schools/${schoolId(req)}/courses`):undefined;const fields=["class_id","section_id","section_name","subject_id","academic_session_id","title","description","status","is_active"];const data:any={...req.body};if(url)data.thumbnail_url=url;const all=[...fields,"thumbnail_url"].filter(f=>data[f]!==undefined);const r=await query(`UPDATE courses SET ${all.map((f,i)=>`${f}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${all.length+1} AND school_id=$${all.length+2} RETURNING *`,[...all.map(f=>data[f]),Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Course not found");res.json(r.rows[0]);});
learningRouter.delete("/courses/:id",staff,async(req,res)=>{const r=await query("UPDATE courses SET is_active=false,updated_at=NOW() WHERE id=$1 AND school_id=$2 RETURNING id",[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Course not found");res.json({message:"Course deleted"});});
learningRouter.post("/courses/:id/sync-enrollments",staff,async(req,res)=>{const course=(await query<any>("SELECT * FROM courses WHERE id=$1 AND school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];if(!course)throw new ApiError(404,"Course not found");const r=await query(`INSERT INTO enrollments(student_id,course_id) SELECT s.user_id,$1 FROM students s WHERE s.school_id=$2 AND s.class_id=$3 AND ($4::int IS NULL OR s.section_id=$4) AND s.user_id IS NOT NULL ON CONFLICT(student_id,course_id) DO NOTHING`,[course.id,schoolId(req),course.class_id,course.section_id]);res.json({message:`${r.rowCount??0} enrollment(s) synchronized`});});
learningRouter.get("/courses/:id/students",staff,async(req,res)=>{const r=await query(`SELECT s.*,e.progress FROM enrollments e JOIN students s ON s.user_id=e.student_id WHERE e.course_id=$1 AND s.school_id=$2`,[Number(req.params.id),schoolId(req)]);res.json(r.rows);});
learningRouter.get("/courses/:id/students/progress",staff,async(req,res)=>{const r=await query(`SELECT s.id student_id,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,e.progress,
 COUNT(l.id)::int total_lessons,COUNT(lp.id) FILTER(WHERE lp.completed)::int completed_lessons FROM enrollments e JOIN students s ON s.user_id=e.student_id LEFT JOIN lessons l ON l.course_id=e.course_id LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.student_id=e.student_id WHERE e.course_id=$1 AND s.school_id=$2 GROUP BY s.id,e.progress ORDER BY student_name`,[Number(req.params.id),schoolId(req)]);res.json({course_id:Number(req.params.id),students:r.rows});});

learningRouter.post("/enrollments/:courseId",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const r=await query("INSERT INTO enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT(student_id,course_id) DO UPDATE SET student_id=EXCLUDED.student_id RETURNING *",[user.id,Number(req.params.courseId)]);res.status(201).json(r.rows[0]);});
learningRouter.delete("/enrollments/:courseId",async(req,res)=>{await query("DELETE FROM enrollments WHERE student_id=$1 AND course_id=$2",[(req as AuthenticatedRequest).user.id,Number(req.params.courseId)]);res.json({message:"Unenrolled"});});
learningRouter.get("/enrollments/my",async(req,res)=>res.json((await query("SELECT * FROM enrollments WHERE student_id=$1",[(req as AuthenticatedRequest).user.id])).rows));
learningRouter.get("/enrollments/check/:courseId",async(req,res)=>res.json({enrolled:Boolean((await query("SELECT 1 FROM enrollments WHERE student_id=$1 AND course_id=$2",[(req as AuthenticatedRequest).user.id,Number(req.params.courseId)])).rowCount)}));

learningRouter.post("/lessons/:courseId",staff,upload.fields([{name:"video",maxCount:1},{name:"pdf",maxCount:1}]),async(req,res)=>{const files=req.files as Record<string,Express.Multer.File[]>|undefined;const video=files?.video?.[0];const pdf=files?.pdf?.[0];const videoUrl=video?await storeUpload(video,`schools/${schoolId(req)}/lessons/video`):req.body.external_video_link||null;const pdfUrl=pdf?await storeUpload(pdf,`schools/${schoolId(req)}/lessons/pdf`):null;const r=await query(`INSERT INTO lessons(title,description,"order",video_url,pdf_url,external_video_link,notes,course_id,language,summary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[req.body.title,req.body.description||null,Number(req.body.order||1),videoUrl,pdfUrl,req.body.external_video_link||null,req.body.notes||req.body.content||null,Number(req.params.courseId),req.body.language||"en",req.body.summary||null]);res.status(201).json(r.rows[0]);});
learningRouter.get("/lessons/course/:courseId",async(req,res)=>{const r=await query(`SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.course_id=$1 AND c.school_id=$2 ORDER BY l."order",l.id`,[Number(req.params.courseId),schoolId(req)]);res.json(r.rows);});
learningRouter.get("/lessons/:id",async(req,res)=>{const row=(await query(`SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=$1 AND c.school_id=$2`,[Number(req.params.id),schoolId(req)])).rows[0];if(!row)throw new ApiError(404,"Lesson not found");res.json(row);});
learningRouter.put("/lessons/:id",staff,upload.fields([{name:"video",maxCount:1},{name:"pdf",maxCount:1}]),async(req,res)=>{const files=req.files as Record<string,Express.Multer.File[]>|undefined;const video=files?.video?.[0];const pdf=files?.pdf?.[0];const videoUrl=video?await storeUpload(video,`schools/${schoolId(req)}/lessons/video`):undefined;const pdfUrl=pdf?await storeUpload(pdf,`schools/${schoolId(req)}/lessons/pdf`):undefined;const r=await query(`UPDATE lessons SET title=COALESCE($1,title),description=COALESCE($2,description),"order"=COALESCE($3,"order"),video_url=COALESCE($4,video_url),pdf_url=COALESCE($5,pdf_url),external_video_link=COALESCE($6,external_video_link),notes=COALESCE($7,notes),language=COALESCE($8,language) WHERE id=$9 AND course_id IN(SELECT id FROM courses WHERE school_id=$10) RETURNING *`,[req.body.title,req.body.description,req.body.order?Number(req.body.order):null,videoUrl,pdfUrl,req.body.external_video_link,req.body.notes||req.body.content,req.body.language,Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Lesson not found");res.json(r.rows[0]);});
learningRouter.delete("/lessons/:id",staff,async(req,res)=>{const r=await query("DELETE FROM lessons WHERE id=$1 AND course_id IN(SELECT id FROM courses WHERE school_id=$2) RETURNING id",[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Lesson not found");res.json({message:"Lesson deleted"});});

learningRouter.get("/progress/:lessonId/watch",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const row=(await query("SELECT * FROM video_watch_progress WHERE student_id=$1 AND lesson_id=$2",[user.id,Number(req.params.lessonId)])).rows[0];res.json(row??{lesson_id:Number(req.params.lessonId),watched_seconds:0,video_duration_seconds:0,max_position_seconds:0,last_position_seconds:0});});
learningRouter.post("/progress/:lessonId/watch",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const r=await query(`INSERT INTO video_watch_progress(student_id,lesson_id,watched_seconds,video_duration_seconds,max_position_seconds,last_position_seconds,last_watch_ping_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(student_id,lesson_id) DO UPDATE SET watched_seconds=GREATEST(video_watch_progress.watched_seconds,$3),video_duration_seconds=GREATEST(video_watch_progress.video_duration_seconds,$4),max_position_seconds=GREATEST(video_watch_progress.max_position_seconds,$5),last_position_seconds=$6,last_watch_ping_at=NOW(),updated_at=NOW() RETURNING *`,[user.id,Number(req.params.lessonId),req.body.watched_seconds??0,req.body.video_duration_seconds??0,req.body.max_position_seconds??0,req.body.last_position_seconds??0]);res.json(r.rows[0]);});
learningRouter.post("/progress/:lessonId/complete",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const r=await query(`INSERT INTO lesson_progress(student_id,lesson_id,completed,completed_at) VALUES($1,$2,true,NOW()) ON CONFLICT(student_id,lesson_id) DO UPDATE SET completed=true,completed_at=NOW() RETURNING *`,[user.id,Number(req.params.lessonId)]);res.json(r.rows[0]);});
learningRouter.delete("/progress/:lessonId/complete",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const r=await query("UPDATE lesson_progress SET completed=false,completed_at=NULL WHERE student_id=$1 AND lesson_id=$2 RETURNING *",[user.id,Number(req.params.lessonId)]);res.json(r.rows[0]??{completed:false});});
learningRouter.get("/progress/course/:courseId",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const r=await query<any>(`SELECT COUNT(l.id)::int total_lessons,COUNT(lp.id) FILTER(WHERE lp.completed)::int completed_lessons FROM lessons l LEFT JOIN lesson_progress lp ON lp.lesson_id=l.id AND lp.student_id=$1 WHERE l.course_id=$2`,[user.id,Number(req.params.courseId)]);const row=r.rows[0];res.json({...row,percentage:row.total_lessons?Math.round(100*row.completed_lessons/row.total_lessons):0});});

learningRouter.post("/assignments/:courseId",staff,async(req,res)=>{const r=await query("INSERT INTO assignments(title,description,due_date,course_id) SELECT $1,$2,$3,id FROM courses WHERE id=$4 AND school_id=$5 RETURNING *",[req.body.title,req.body.description??null,req.body.due_date??null,Number(req.params.courseId),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Course not found");res.status(201).json(r.rows[0]);});
learningRouter.get("/assignments/course/:courseId",async(req,res)=>{const r=await query("SELECT a.* FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.course_id=$1 AND c.school_id=$2 ORDER BY a.created_at DESC",[Number(req.params.courseId),schoolId(req)]);res.json(r.rows);});
learningRouter.put("/assignments/:id",staff,async(req,res)=>{const r=await query("UPDATE assignments SET title=COALESCE($1,title),description=COALESCE($2,description),due_date=COALESCE($3,due_date) WHERE id=$4 AND course_id IN(SELECT id FROM courses WHERE school_id=$5) RETURNING *",[req.body.title,req.body.description,req.body.due_date,Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Assignment not found");res.json(r.rows[0]);});
learningRouter.delete("/assignments/:id",staff,async(req,res)=>{const r=await query("DELETE FROM assignments WHERE id=$1 AND course_id IN(SELECT id FROM courses WHERE school_id=$2) RETURNING id",[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Assignment not found");res.json({message:"Assignment deleted"});});
learningRouter.post("/assignments/:id/submit",upload.single("file"),async(req,res)=>{const user=(req as AuthenticatedRequest).user;const url=req.file?await storeUpload(req.file,`schools/${schoolId(req)}/assignments`):req.body.file_url??null;const r=await query(`INSERT INTO submissions(student_id,assignment_id,file_url) VALUES($1,$2,$3) ON CONFLICT(student_id,assignment_id) DO UPDATE SET file_url=$3,submitted_at=NOW() RETURNING *`,[user.id,Number(req.params.id),url]);res.status(201).json(r.rows[0]);});
learningRouter.get("/assignments/:id/submissions",staff,async(req,res)=>{const r=await query("SELECT s.*,u.full_name student_name FROM submissions s JOIN users u ON u.id=s.student_id WHERE s.assignment_id=$1 ORDER BY s.submitted_at DESC",[Number(req.params.id)]);res.json(r.rows);});
learningRouter.put("/assignments/submissions/:id/grade",staff,async(req,res)=>{const r=await query("UPDATE submissions SET grade=$1,feedback=$2 WHERE id=$3 RETURNING *",[req.body.grade,req.body.feedback??null,Number(req.params.id)]);if(!r.rows[0])throw new ApiError(404,"Submission not found");res.json(r.rows[0]);});
learningRouter.get("/assignments/:id/my-submission",async(req,res)=>{const row=(await query("SELECT * FROM submissions WHERE assignment_id=$1 AND student_id=$2",[Number(req.params.id),(req as AuthenticatedRequest).user.id])).rows[0];res.json(row??null);});
