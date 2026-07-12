# Express + FastAPI migration and free deployment

## Final architecture

```text
Browser -> Next.js static frontend -> Express/TypeScript API -> PostgreSQL
                                              |             -> optional Redis
                                              +-> private FastAPI AI service -> AI provider
```

Only Express is public. FastAPI checks a private service token and does not own passwords, payment keys, authorization rules, or ERP tables.

## Why this targets the slow navigation

Switching frameworks alone does not remove a 5–6 second delay. This migration adds:

- a bounded PostgreSQL connection pool and statement timeout;
- tenant-safe indexed queries instead of loading full tables;
- Redis caching for dashboard reads with safe no-Redis fallback;
- response compression and duplicate GET suppression in the frontend;
- one public API hop; AI is called only for AI actions;
- timing and structured request logs;
- database indexes for the common school/class/date/status lookups.

Use the browser Network panel and the `X-Process-Time-ms` response header to separate frontend, API, database, and cold-start time.

## Existing database migration

1. Back up the current PostgreSQL database before changing deployment.
2. Point `server/.env` to a staging copy of the current database.
3. Run `npm run db:migrate` from `server`.
4. Start both services and perform the checklist below.
5. Keep the old FastAPI deployment read-only until the checklist passes. Do not let both backends write to production concurrently.

The initial SQL uses `CREATE TABLE IF NOT EXISTS`, so it preserves existing rows. Review schema differences in staging if the old project has manual database changes not present in source control.

## $0 portfolio deployment

The most practical no-charge portfolio setup is:

1. **Frontend:** Vercel Hobby, root directory `frontend`, build command `npm run build`, output directory `out`. Set `NEXT_PUBLIC_API_BASE_URL` to the Render URL.
2. **Database:** Neon Free PostgreSQL. Copy its pooled connection string into `DATABASE_URL` and set `DATABASE_SSL=true`.
3. **Express + FastAPI:** one Render Free Docker service using `render.yaml`. It runs two separate processes in one container, with FastAPI reachable only on localhost. This avoids paying for two services and avoids two separate service wake-ups.
4. **Files:** configure Cloudinary. Do not rely on the container's local `uploads` directory in production because free containers use ephemeral storage.
5. **Redis:** leave `REDIS_URL` unset on the free demo. The API works without it. Add managed Redis only when traffic justifies it.

### Important free-tier limitation

No $0 setup can honestly promise an always-warm, instant API. Render Free services sleep after inactivity and Neon Free suspends idle database compute. The static frontend opens quickly, but the first authenticated request after inactivity can be slow. For an interview, open the demo once before presenting it. For real users, move the API and database to always-on paid compute.

AI provider calls may also cost money after any provider-specific free credit or free quota is exhausted. The application itself does not silently buy capacity.

## Render environment values

Required: `DATABASE_URL`, `DATABASE_SSL=true`, `JWT_SECRET`, `AI_SERVICE_TOKEN`, `CORS_ORIGINS`, `FRONTEND_URL`, `PUBLIC_API_URL`.

AI: `OPENROUTER_API_KEY` or `OPENAI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`.

Optional: Cloudinary, Razorpay, SMTP, BigBlueButton, and Redis values from the environment templates.

Use exact HTTPS origins in `CORS_ORIGINS`; do not use `*` with credential cookies. Set `COOKIE_SECURE=true` in production.

## Release checklist

- Register a school and verify OTP/debug flow.
- Login as owner, teacher, student, and parent; confirm wrong portal role is rejected.
- Confirm users from one school cannot read or modify another school's IDs.
- Create session, class, section, subject, teacher, and student.
- Mark attendance and verify student/report views.
- Create and submit homework; check it as teacher.
- Create an exam, subjects, marks, publish, and view report cards.
- Create fee structure, generate records, take a manual payment, and read receipt.
- Add/issue/return a library book.
- Create course and lesson, then test progress.
- Test AI notice, curriculum, summary, quiz, and streaming chat.
- Upload an image and document, and verify URLs survive redeploy through Cloudinary.
- Verify `/health`, `/ready`, logs, CORS, secure cookies, rate limits, and database backup.
- Run TypeScript typecheck, tests, Express build, Python compile, and frontend production build.

## Résumé wording

> Built a multi-tenant School ERP with Next.js, Express 5/TypeScript, PostgreSQL, optional Redis caching, JWT refresh-token rotation, tenant-scoped RBAC, payments, reporting, and a private FastAPI AI microservice for RAG-style lesson assistance, summaries, quizzes, and curriculum generation. Optimized API latency with pooled connections, indexed queries, response caching, request deduplication, and performance telemetry.

Do not claim a measured latency reduction until you run before/after tests against the same database and deployment region.
