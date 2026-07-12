import { Router } from "express";
import { allowRoles, requireAuth, schoolId } from "../auth.js";
import { query, transaction } from "../db.js";
import { ApiError } from "../errors.js";
import type { AuthenticatedRequest } from "../types.js";

export const communicationRouter = Router();
communicationRouter.use(requireAuth);
const staff = allowRoles("SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN", "TEACHER");

const configs = {
  announcements: { table: "communication_announcements", fields: ["title", "message", "priority", "status", "audience_roles", "start_at", "end_at"] },
  events: { table: "communication_events", fields: ["title", "description", "event_date", "end_date", "start_time", "end_time", "location", "category", "status", "audience_roles"] },
  complaints: { table: "complaints", fields: ["assigned_to", "subject", "description", "category", "priority", "status", "action_taken", "is_anonymous", "resolved_at"] },
} as const;

function safeConfig(kind: keyof typeof configs) { return configs[kind]; }
for (const kind of Object.keys(configs) as (keyof typeof configs)[]) {
  const cfg = safeConfig(kind);
  communicationRouter.get(`/${kind}`, async (req, res) => {
    const user = (req as AuthenticatedRequest).user;
    const values: unknown[] = [schoolId(req)];
    let where = "school_id=$1";
    if (kind === "complaints" && !["SUPER_ADMIN", "SCHOOL_OWNER", "SCHOOL_ADMIN"].includes(user.role)) {
      values.push(user.id); where += ` AND created_by=$${values.length}`;
    }
    const result = await query(`SELECT * FROM ${cfg.table} WHERE ${where} ORDER BY created_at DESC LIMIT 500`, values);
    res.json(result.rows);
  });
  communicationRouter.post(`/${kind}`, kind === "complaints" ? requireAuth : staff, async (req, res) => {
    const data = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => (cfg.fields as readonly string[]).includes(key) && value !== undefined));
    const columns = Object.keys(data); const values = Object.values(data);
    const result = await query(
      `INSERT INTO ${cfg.table}(school_id,created_by,${columns.join(",")}) VALUES($1,$2,${columns.map((_,i)=>`$${i+3}`).join(",")}) RETURNING *`,
      [schoolId(req), (req as AuthenticatedRequest).user.id, ...values],
    );
    res.status(201).json(result.rows[0]);
  });
  communicationRouter.patch(`/${kind}/:id`, staff, async (req, res) => {
    const data = Object.fromEntries(Object.entries(req.body).filter(([key, value]) => (cfg.fields as readonly string[]).includes(key) && value !== undefined));
    const columns = Object.keys(data); const values = Object.values(data);
    if (!columns.length) throw new ApiError(422, "No valid fields supplied");
    const result = await query(
      `UPDATE ${cfg.table} SET ${columns.map((key,i)=>`${key}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${columns.length+1} AND school_id=$${columns.length+2} RETURNING *`,
      [...values, Number(req.params.id), schoolId(req)],
    );
    if (!result.rows[0]) throw new ApiError(404, "Record not found");
    res.json(result.rows[0]);
  });
  if (kind !== "complaints") communicationRouter.delete(`/${kind}/:id`, staff, async (req, res) => {
    const result = await query(`DELETE FROM ${cfg.table} WHERE id=$1 AND school_id=$2 RETURNING id`, [Number(req.params.id), schoolId(req)]);
    if (!result.rowCount) throw new ApiError(404, "Record not found");
    res.json({ message: "Deleted successfully" });
  });
}

communicationRouter.post("/notifications", staff, async (req, res) => {
  const fields = ["target_role", "target_user_id", "title", "message", "category", "priority", "link", "expires_at"];
  const data = Object.fromEntries(Object.entries(req.body).filter(([key,value])=>fields.includes(key)&&value!==undefined));
  const columns=Object.keys(data); const values=Object.values(data);
  const result=await query(`INSERT INTO in_app_notifications(school_id,created_by,${columns.join(",")}) VALUES($1,$2,${columns.map((_,i)=>`$${i+3}`).join(",")}) RETURNING *`,[schoolId(req),(req as AuthenticatedRequest).user.id,...values]);
  res.status(201).json(result.rows[0]);
});

async function visibleNotifications(req: import("express").Request, countOnly=false) {
  const user=(req as AuthenticatedRequest).user;
  const select=countOnly?"COUNT(*)::int AS count":"n.*, (r.id IS NOT NULL) AS is_read";
  const result=await query<any>(
    `SELECT ${select} FROM in_app_notifications n LEFT JOIN in_app_notification_reads r ON r.notification_id=n.id AND r.user_id=$1
     WHERE n.school_id=$2 AND (n.target_user_id=$1 OR (n.target_user_id IS NULL AND (n.target_role IS NULL OR n.target_role=$3)))
       AND (n.expires_at IS NULL OR n.expires_at>NOW()) ${countOnly?"AND r.id IS NULL":"ORDER BY n.created_at DESC LIMIT 500"}`,
    [user.id,schoolId(req),user.role],
  );
  return countOnly?(result.rows[0]??{count:0}):result.rows;
}
communicationRouter.get("/notifications/unread-count",async(req,res)=>res.json(await visibleNotifications(req,true)));
communicationRouter.get("/notifications",async(req,res)=>res.json(await visibleNotifications(req)));
communicationRouter.post("/notifications/read-all",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  await query(`INSERT INTO in_app_notification_reads(notification_id,user_id)
    SELECT n.id,$1 FROM in_app_notifications n WHERE n.school_id=$2 AND (n.target_user_id=$1 OR n.target_user_id IS NULL)
    ON CONFLICT(notification_id,user_id) DO NOTHING`,[user.id,schoolId(req)]);
  res.json({message:"All notifications marked as read"});
});
communicationRouter.post("/notifications/:id/read",async(req,res)=>{
  await query("INSERT INTO in_app_notification_reads(notification_id,user_id) VALUES($1,$2) ON CONFLICT(notification_id,user_id) DO NOTHING",[Number(req.params.id),(req as AuthenticatedRequest).user.id]);
  res.json({message:"Notification marked as read"});
});
communicationRouter.get("/overview",async(req,res)=>{
  const sid=schoolId(req);
  const result=await query<any>(`SELECT
    (SELECT COUNT(*)::int FROM communication_announcements WHERE school_id=$1) announcements,
    (SELECT COUNT(*)::int FROM communication_events WHERE school_id=$1 AND event_date>=CURRENT_DATE) upcoming_events,
    (SELECT COUNT(*)::int FROM complaints WHERE school_id=$1 AND status NOT IN ('RESOLVED','CLOSED')) open_complaints`,[sid]);
  res.json(result.rows[0]);
});

export const noticesRouter=Router();
noticesRouter.use(requireAuth);
noticesRouter.post("/",staff,async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  const row=await transaction(async client=>{
    const result=await client.query<any>(`INSERT INTO notices(school_id,created_by,title,content,priority,status,is_pinned,publish_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[schoolId(req),user.id,req.body.title,req.body.content,req.body.priority??"NORMAL",req.body.status??"PUBLISHED",Boolean(req.body.is_pinned),req.body.publish_at??null,req.body.expires_at??null]);
    const notice=result.rows[0];
    for(const role of req.body.audience_roles??[]) await client.query("INSERT INTO notice_audiences(notice_id,role) VALUES($1,$2)",[notice.id,role]);
    for(const target of req.body.class_audiences??[]) await client.query("INSERT INTO notice_class_audiences(notice_id,class_id,section_id,section_name) VALUES($1,$2,$3,$4)",[notice.id,target.class_id,target.section_id??null,target.section_name??null]);
    return notice;
  });
  res.status(201).json(row);
});
noticesRouter.get("/",async(req,res)=>{
  const user=(req as AuthenticatedRequest).user;
  const params:unknown[]=[schoolId(req),user.id,user.role];
  const result=await query<any>(`SELECT n.*,u.full_name AS created_by_name,(nr.id IS NOT NULL) AS is_read,
    COALESCE((SELECT json_agg(na.role) FROM notice_audiences na WHERE na.notice_id=n.id),'[]') AS audience_roles
    FROM notices n JOIN users u ON u.id=n.created_by LEFT JOIN notice_reads nr ON nr.notice_id=n.id AND nr.user_id=$2
    WHERE n.school_id=$1 AND (n.status='PUBLISHED' OR n.created_by=$2) AND (n.expires_at IS NULL OR n.expires_at>NOW())
    AND (NOT EXISTS(SELECT 1 FROM notice_audiences x WHERE x.notice_id=n.id) OR EXISTS(SELECT 1 FROM notice_audiences x WHERE x.notice_id=n.id AND x.role=$3))
    ORDER BY n.is_pinned DESC,n.created_at DESC LIMIT 200`,params);
  res.json({items:result.rows,total:result.rowCount??0});
});
noticesRouter.get("/:id",async(req,res)=>{
  const row=(await query("SELECT * FROM notices WHERE id=$1 AND school_id=$2",[Number(req.params.id),schoolId(req)])).rows[0];
  if(!row)throw new ApiError(404,"Notice not found"); res.json(row);
});
noticesRouter.patch("/:id",staff,async(req,res)=>{
  const allowed=["title","content","priority","status","is_pinned","publish_at","expires_at"];
  const data=Object.fromEntries(Object.entries(req.body).filter(([k,v])=>allowed.includes(k)&&v!==undefined)); const cols=Object.keys(data);
  const result=await query(`UPDATE notices SET ${cols.map((k,i)=>`${k}=$${i+1}`).join(",")},updated_at=NOW() WHERE id=$${cols.length+1} AND school_id=$${cols.length+2} RETURNING *`,[...Object.values(data),Number(req.params.id),schoolId(req)]);
  if(!result.rows[0])throw new ApiError(404,"Notice not found");res.json(result.rows[0]);
});
noticesRouter.patch("/:id/pin",staff,async(req,res)=>{
  const result=await query("UPDATE notices SET is_pinned=COALESCE($1,NOT is_pinned),pinned_by=$2,updated_at=NOW() WHERE id=$3 AND school_id=$4 RETURNING *",[req.body.is_pinned,(req as AuthenticatedRequest).user.id,Number(req.params.id),schoolId(req)]);
  if(!result.rows[0])throw new ApiError(404,"Notice not found");res.json(result.rows[0]);
});
noticesRouter.post("/:id/read",async(req,res)=>{await query("INSERT INTO notice_reads(notice_id,user_id) VALUES($1,$2) ON CONFLICT(notice_id,user_id) DO NOTHING",[Number(req.params.id),(req as AuthenticatedRequest).user.id]);res.json({message:"Notice marked as read"});});
noticesRouter.delete("/:id",staff,async(req,res)=>{const result=await query("DELETE FROM notices WHERE id=$1 AND school_id=$2 RETURNING id",[Number(req.params.id),schoolId(req)]);if(!result.rowCount)throw new ApiError(404,"Notice not found");res.status(204).end();});
