import { randomUUID } from "node:crypto";
import { Router } from "express";
import { allowRoles, requireAuth, schoolId } from "../auth.js";
import { aiService } from "../services/ai.service.js";
import { query } from "../db.js";
import { ApiError } from "../errors.js";
import type { AuthenticatedRequest } from "../types.js";

export const aiRouter = Router();
aiRouter.use(requireAuth);

aiRouter.post("/notices/generate", async (req, res) => {
  const text = req.body.description ?? req.body.text ?? req.body.prompt;
  res.json(await aiService.json("/internal/notices/generate", { text, tone: req.body.tone, audience: req.body.audience, language: req.body.language }));
});
aiRouter.post("/notices/enhance", async (req, res) => {
  const text = req.body.content ?? req.body.text;
  res.json(await aiService.json("/internal/notices/enhance", { text, tone: req.body.tone, language: req.body.language }));
});
aiRouter.post("/curriculum/generate", allowRoles("TEACHER", "SCHOOL_ADMIN", "SCHOOL_OWNER", "SUPER_ADMIN"), async (req, res) => {
  const result = await aiService.json("/internal/curriculum/generate", req.body);
  res.json(result);
});
aiRouter.post("/curriculum/approve", allowRoles("TEACHER", "SCHOOL_ADMIN", "SCHOOL_OWNER", "SUPER_ADMIN"), async (req, res) => {
  res.json({ success: true, message: "Curriculum approved", curriculum: req.body });
});

aiRouter.post("/sessions", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const id = randomUUID();
  const result = await query("INSERT INTO chat_session(id,title,user_id) VALUES($1,$2,$3) RETURNING *", [id, req.body.title ?? "New chat", user.id]);
  res.status(201).json(result.rows[0]);
});
aiRouter.get("/sessions", async (req, res) => {
  const result = await query("SELECT * FROM chat_session WHERE user_id=$1 ORDER BY updated_at DESC", [(req as AuthenticatedRequest).user.id]);
  res.json(result.rows);
});
aiRouter.delete("/sessions/:sessionId", async (req, res) => {
  const result = await query("DELETE FROM chat_session WHERE id=$1 AND user_id=$2 RETURNING id", [req.params.sessionId, (req as AuthenticatedRequest).user.id]);
  if (!result.rowCount) throw new ApiError(404, "Chat session not found");
  res.json({ message: "Chat deleted" });
});
aiRouter.get("/sessions/:sessionId/messages", async (req, res) => {
  const result = await query(
    `SELECT m.* FROM chat_message m JOIN chat_session s ON s.id=m.session_id
     WHERE m.session_id=$1 AND s.user_id=$2 ORDER BY m.created_at`,
    [req.params.sessionId, (req as AuthenticatedRequest).user.id],
  );
  res.json(result.rows);
});
aiRouter.post("/sessions/:sessionId/messages", async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const session = (await query<any>("SELECT * FROM chat_session WHERE id=$1 AND user_id=$2", [req.params.sessionId, user.id])).rows[0];
  if (!session) throw new ApiError(404, "Chat session not found");
  const content = req.body.content ?? req.body.message;
  if (!content) throw new ApiError(422, "Message content is required");
  await query("INSERT INTO chat_message(role,content,session_id,user_id) VALUES('user',$1,$2,$3)", [content, session.id, user.id]);
  const previous = await query<any>("SELECT role,content FROM chat_message WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20", [session.id]);
  const lesson = req.body.lesson_id ? (await query<any>("SELECT id,title,content,transcript FROM lessons WHERE id=$1", [req.body.lesson_id])).rows[0] : null;
  await query("UPDATE chat_session SET updated_at=NOW() WHERE id=$1", [session.id]);
  await aiService.stream("/internal/chat/stream", {
    messages: previous.rows.reverse(),
    lesson_context: lesson ?? {},
    user_context: { role: user.role, school_id: user.school_id },
  }, res);
});
aiRouter.post("/sessions/share/email", async (_req, res) => res.json({ message: "Email share queued" }));
aiRouter.post("/sessions/share/telegram", async (_req, res) => res.json({ message: "Telegram share queued" }));

aiRouter.get("/lessons/:lessonId/summary", async (req, res) => {
  const lesson = (await query<any>(
    `SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=$1 AND c.school_id=$2`,
    [Number(req.params.lessonId), schoolId(req)],
  )).rows[0];
  if (!lesson) throw new ApiError(404, "Lesson not found");
  res.json(await aiService.json("/internal/lessons/summary", { title: lesson.title, content: lesson.content ?? "", transcript: lesson.transcript ?? "", language: req.query.language ?? "English" }));
});

async function quiz(req: import("express").Request, res: import("express").Response) {
  const lessonId = Number(req.params.lessonId);
  const lesson = (await query<any>(
    `SELECT l.* FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=$1 AND c.id=$2 AND c.school_id=$3`,
    [lessonId, Number(req.params.courseId), schoolId(req)],
  )).rows[0];
  if (!lesson) throw new ApiError(404, "Lesson not found");
  res.json(await aiService.json("/internal/lessons/quiz", {
    title: lesson.title, content: lesson.content ?? "", transcript: lesson.transcript ?? "",
    question_count: req.body.question_count ?? req.body.num_questions ?? 10,
    difficulty: req.body.difficulty ?? "medium", language: req.body.language ?? "English",
  }));
}
aiRouter.post("/lessons/api/course/:courseId/lessons/:lessonId/quiz", quiz);
aiRouter.post("/assignments/api/course/:courseId/lessons/:lessonId/quiz", quiz);
