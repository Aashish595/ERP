# Multi-Tenant School ERP

A portfolio-ready school ERP using a hybrid backend:

- **Express 5 + TypeScript** owns authentication, multi-tenant business rules, PostgreSQL, caching, uploads, payments, reports, and all public APIs.
- **FastAPI** is a private AI microservice for curriculum generation, notice writing, lesson summaries, quizzes, and streaming lesson chat.
- **Next.js + TypeScript** is exported as a static frontend.
- **PostgreSQL** stores transactional data. Redis is optional and the app degrades safely when it is unavailable.

The public API remains on port `8000`, so existing frontend paths are compatible with the former FastAPI backend.

## Main modules

School registration and JWT refresh rotation; role and tenant isolation; academic sessions; departments; classes; sections; subjects; students; teachers; parent accounts; attendance; homework; timetable; exams and report cards; fees and Razorpay verification; notices; communication; notifications; courses; lessons; progress; assignments; AI lesson chat; meetings; reports; and library circulation.

## Local start with Docker

1. Copy the environment templates:

   ```bash
   cp server/.env.example server/.env
   cp ai-service/.env.example ai-service/.env
   cp frontend/.env.local.example frontend/.env.local
   ```

2. Put the same long random value in `AI_SERVICE_TOKEN` in both backend files. Set a different long `JWT_SECRET` in `server/.env`.

3. Start the backend stack:

   ```bash
   docker compose up --build
   ```

4. Start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open `http://localhost:3000`. API health is at `http://localhost:8000/health`.

## Run without Docker

Use PostgreSQL 16 and optionally Redis 7. Then:

```bash
cd server
npm install
npm run db:migrate
npm run dev
```

In a second terminal:

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Validation

```bash
cd server
npm run typecheck
npm test
npm run build

cd ../frontend
npm install
npm run build
```

See [MIGRATION_AND_FREE_DEPLOYMENT.md](MIGRATION_AND_FREE_DEPLOYMENT.md) for database migration, free deployment, performance expectations, and résumé wording.

See [server/FULL_BACKEND_STRUCTURE.md](server/FULL_BACKEND_STRUCTURE.md) for the complete model–repository–service–controller–route mapping.
