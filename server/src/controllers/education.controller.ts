import { Router } from "express";
import { activeAcademicSessionId, allowRoles, requireAuth, schoolId } from "../auth.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import { upload } from "../uploads.js";
import { uploadService } from "../services/upload.service.js";
import type { AuthenticatedRequest } from "../types.js";

export const educationRouter=Router();
const storeUpload = uploadService.store.bind(uploadService);
educationRouter.use(requireAuth);
const staff=allowRoles("SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN","TEACHER");

educationRouter.get("/attendance/my-classes",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  if(["SUPER_ADMIN","SCHOOL_OWNER","SCHOOL_ADMIN"].includes(user.role)){
    const rows=await query("SELECT c.id,c.name,s.id section_id,s.name section_name FROM school_classes c LEFT JOIN sections s ON s.class_id=c.id WHERE c.school_id=$1 AND c.is_active=true ORDER BY c.name,s.name",[schoolId(req)]);return res.json(rows.rows);
  }
  const rows=await query(`SELECT DISTINCT c.id,c.name,COALESCE(cta.section_id,ts.section_id) section_id,COALESCE(cta.section_name,ts.section_name) section_name
    FROM teachers t LEFT JOIN class_teacher_assignments cta ON cta.teacher_id=t.id LEFT JOIN teacher_subjects ts ON ts.teacher_id=t.id
    JOIN school_classes c ON c.id=COALESCE(cta.class_id,ts.class_id) WHERE t.user_id=$1`,[user.id]);res.json(rows.rows);
});
educationRouter.get("/attendance/sheet",staff,async(req,res)=>{
  const sid=schoolId(req);const date=String(req.query.date??new Date().toISOString().slice(0,10));const classId=Number(req.query.class_id);const sectionId=req.query.section_id?Number(req.query.section_id):null;
  const result=await query(`SELECT s.id student_id,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,s.roll_number,
    a.id attendance_id,COALESCE(a.status,'PRESENT') status,a.note FROM students s LEFT JOIN student_attendance a ON a.student_id=s.id AND a.date=$1
    WHERE s.school_id=$2 AND s.class_id=$3 AND ($4::int IS NULL OR s.section_id=$4) AND s.is_active=true ORDER BY s.roll_number,s.first_name`,[date,sid,classId,sectionId]);res.json(result.rows);
});
educationRouter.post("/attendance/bulk",staff,async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;const sid=schoolId(req);const session=Number(req.body.session_id??await activeAcademicSessionId(req));
  const records=req.body.records??req.body.items??[];
  const rows=await transaction(async client=>{const output=[];for(const item of records){const result=await client.query(`INSERT INTO student_attendance(school_id,session_id,student_id,class_id,section_id,section_name,marked_by,date,status,note)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(school_id,session_id,student_id,date) DO UPDATE SET status=$9,note=$10,marked_by=$7,updated_at=NOW() RETURNING *`,[sid,session,item.student_id,req.body.class_id??item.class_id,req.body.section_id??item.section_id??null,item.section_name??null,user.id,req.body.date,item.status,item.note??null]);output.push(result.rows[0]);}return output;});
  res.status(201).json(rows);
});
educationRouter.patch("/attendance/:id",staff,async(req,res)=>{const result=await query("UPDATE student_attendance SET status=COALESCE($1,status),note=COALESCE($2,note),updated_at=NOW() WHERE id=$3 AND school_id=$4 RETURNING *",[req.body.status,req.body.note,Number(req.params.id),schoolId(req)]);if(!result.rows[0])throw new ApiError(404,"Attendance record not found");res.json(result.rows[0]);});
educationRouter.get("/attendance/summary",async(req,res)=>{
  const params:unknown[]=[schoolId(req)];let where="s.school_id=$1";
  for(const [field,column] of [["class_id","s.class_id"],["section_id","s.section_id"],["session_id","a.session_id"]] as const){if(req.query[field]){params.push(Number(req.query[field]));where+=` AND ${column}=$${params.length}`;}}
  const result=await query(`SELECT s.id student_id,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no,COUNT(a.id)::int total_days,
    COUNT(*) FILTER(WHERE a.status='PRESENT')::int present,COUNT(*) FILTER(WHERE a.status='ABSENT')::int absent,COUNT(*) FILTER(WHERE a.status='LEAVE')::int leave,
    COUNT(*) FILTER(WHERE a.status='HALF_DAY')::int half_day,ROUND(CASE WHEN COUNT(a.id)=0 THEN 0 ELSE 100.0*(COUNT(*) FILTER(WHERE a.status='PRESENT')+.5*COUNT(*) FILTER(WHERE a.status='HALF_DAY'))/COUNT(a.id) END,2)::float percentage
    FROM students s LEFT JOIN student_attendance a ON a.student_id=s.id WHERE ${where} GROUP BY s.id ORDER BY s.first_name`,params);
  res.json(result.rows.map((r:any)=>({...r,low_attendance:r.percentage<75})));
});
educationRouter.get("/attendance/by-date",async(req,res)=>{const result=await query("SELECT * FROM student_attendance WHERE school_id=$1 AND date=$2 ORDER BY student_id",[schoolId(req),req.query.date]);res.json(result.rows);});
educationRouter.get("/attendance/my",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const result=await query(`SELECT a.* FROM student_attendance a JOIN students s ON s.id=a.student_id WHERE s.user_id=$1 ORDER BY a.date DESC LIMIT 500`,[user.id]);res.json(result.rows);});

async function homeworkRows(req:import("express").Request,whereExtra="",values:unknown[]=[]){return (await query<any>(`SELECT h.*,c.name class_name,s.name section_name,sub.name subject_name,t.full_name teacher_name,
  (SELECT json_build_object('total_students',COUNT(*),'pending',COUNT(*) FILTER(WHERE hs.id IS NULL),'submitted',COUNT(*) FILTER(WHERE hs.status='SUBMITTED'),'checked',COUNT(*) FILTER(WHERE hs.status='CHECKED')) FROM students st LEFT JOIN homework_submissions hs ON hs.student_id=st.id AND hs.homework_id=h.id WHERE st.class_id=h.class_id AND (h.section_id IS NULL OR st.section_id=h.section_id)) stats
  FROM homework_assignments h JOIN school_classes c ON c.id=h.class_id LEFT JOIN sections s ON s.id=h.section_id LEFT JOIN subjects sub ON sub.id=h.subject_id LEFT JOIN teachers t ON t.id=h.teacher_id
  WHERE h.school_id=$1 ${whereExtra} ORDER BY h.due_date DESC`,[schoolId(req),...values])).rows;}
educationRouter.get("/homework/meta",staff,async(req,res)=>{const sid=schoolId(req);const [classes,sections,subjects,teachers]=await Promise.all([query("SELECT id,name FROM school_classes WHERE school_id=$1 AND is_active=true",[sid]),query("SELECT id,name,class_id FROM sections WHERE school_id=$1 AND is_active=true",[sid]),query("SELECT id,name,class_id FROM subjects WHERE school_id=$1 AND is_active=true",[sid]),query("SELECT id,full_name name FROM teachers WHERE school_id=$1 AND is_active=true",[sid])]);res.json({classes:classes.rows,sections:sections.rows,subjects:subjects.rows,teachers:teachers.rows,current_academic_session_id:await activeAcademicSessionId(req)});});
educationRouter.get("/homework/assignments",staff,async(req,res)=>{const values=[];let extra="";if(req.query.class_id){values.push(Number(req.query.class_id));extra+=` AND h.class_id=$${values.length+1}`;}res.json(await homeworkRows(req,extra,values));});
educationRouter.post("/homework/assignments",staff,upload.single("attachment"),async(req,res)=>{const body=req.body;const url=req.file?await storeUpload(req.file,`schools/${schoolId(req)}/homework`):null;const result=await query(`INSERT INTO homework_assignments(school_id,teacher_id,class_id,section_id,section_name,subject_id,academic_session_id,title,description,due_date,attachment_url,attachment_filename)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[schoolId(req),body.teacher_id||null,body.class_id,body.section_id||null,body.section_name||null,body.subject_id||null,body.academic_session_id||await activeAcademicSessionId(req),body.title,body.description||null,body.due_date,url,req.file?.originalname??null]);res.status(201).json(result.rows[0]);});
educationRouter.put("/homework/assignments/:id",staff,upload.single("attachment"),async(req,res)=>{const url=req.file?await storeUpload(req.file,`schools/${schoolId(req)}/homework`):undefined;const result=await query(`UPDATE homework_assignments SET title=COALESCE($1,title),description=COALESCE($2,description),due_date=COALESCE($3,due_date),class_id=COALESCE($4,class_id),section_id=COALESCE($5,section_id),subject_id=COALESCE($6,subject_id),attachment_url=COALESCE($7,attachment_url),attachment_filename=COALESCE($8,attachment_filename),updated_at=NOW() WHERE id=$9 AND school_id=$10 RETURNING *`,[req.body.title,req.body.description,req.body.due_date,req.body.class_id||null,req.body.section_id||null,req.body.subject_id||null,url,req.file?.originalname,Number(req.params.id),schoolId(req)]);if(!result.rows[0])throw new ApiError(404,"Homework not found");res.json(result.rows[0]);});
educationRouter.delete("/homework/assignments/:id",staff,async(req,res)=>{const r=await query("DELETE FROM homework_assignments WHERE id=$1 AND school_id=$2 RETURNING id",[Number(req.params.id),schoolId(req)]);if(!r.rowCount)throw new ApiError(404,"Homework not found");res.json({message:"Deleted successfully"});});
educationRouter.get("/homework/assignments/:id/submissions",staff,async(req,res)=>{const r=await query(`SELECT hs.*,concat_ws(' ',s.first_name,s.last_name) student_name,s.admission_no FROM homework_submissions hs JOIN students s ON s.id=hs.student_id WHERE hs.homework_id=$1 AND hs.school_id=$2 ORDER BY hs.created_at DESC`,[Number(req.params.id),schoolId(req)]);res.json(r.rows);});
educationRouter.get("/homework/student/assignments",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const student=(await query<any>("SELECT * FROM students WHERE user_id=$1",[user.id])).rows[0];if(!student)return res.json([]);const rows=await homeworkRows(req,"AND h.class_id=$2 AND (h.section_id IS NULL OR h.section_id=$3)",[student.class_id,student.section_id]);const submissions=await query<any>("SELECT * FROM homework_submissions WHERE student_id=$1",[student.id]);const map=new Map(submissions.rows.map((s:any)=>[s.homework_id,s]));res.json(rows.map((h:any)=>{const s:any=map.get(h.id);return{...h,submission_id:s?.id,submission_status:s?.status??"PENDING",submitted_at:s?.created_at,answer_text:s?.answer_text,submission_attachment_url:s?.attachment_url,submission_attachment_filename:s?.attachment_filename};}));});
educationRouter.post("/homework/assignments/:id/submit",upload.single("attachment"),async(req,res)=>{const student=(await query<any>("SELECT * FROM students WHERE user_id=$1",[(req as AuthenticatedRequest).user.id])).rows[0];if(!student)throw new ApiError(403,"Student profile required");const url=req.file?await storeUpload(req.file,`schools/${schoolId(req)}/homework-submissions`):null;const result=await query(`INSERT INTO homework_submissions(school_id,homework_id,student_id,answer_text,attachment_url,attachment_filename,status)
  VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED') ON CONFLICT(school_id,homework_id,student_id) DO UPDATE SET answer_text=$4,attachment_url=COALESCE($5,homework_submissions.attachment_url),attachment_filename=COALESCE($6,homework_submissions.attachment_filename),status='SUBMITTED',updated_at=NOW() RETURNING *`,[schoolId(req),Number(req.params.id),student.id,req.body.answer_text||null,url,req.file?.originalname??null]);res.json(result.rows[0]);});
educationRouter.patch("/homework/submissions/:id/check",staff,async(req,res)=>{const r=await query("UPDATE homework_submissions SET status='CHECKED',teacher_feedback=$1,checked_at=NOW(),updated_at=NOW() WHERE id=$2 AND school_id=$3 RETURNING *",[req.body.teacher_feedback??req.body.feedback,Number(req.params.id),schoolId(req)]);if(!r.rows[0])throw new ApiError(404,"Submission not found");res.json(r.rows[0]);});
educationRouter.get("/homework/parent/assignments",async(req,res)=>{const user=(req as AuthenticatedRequest).user;const result=await query<any>(`SELECT s.id student_id,concat_ws(' ',s.first_name,s.last_name) student_name,h.*,COALESCE(hs.status,'PENDING') submission_status FROM parent_guardians g JOIN students s ON s.guardian_id=g.id JOIN homework_assignments h ON h.class_id=s.class_id AND (h.section_id IS NULL OR h.section_id=s.section_id) LEFT JOIN homework_submissions hs ON hs.homework_id=h.id AND hs.student_id=s.id WHERE g.user_id=$1 ORDER BY h.due_date DESC`,[user.id]);res.json(result.rows);});
