# Full Express backend structure

The previous compact patch stored SQL table definitions in one migration and grouped controllers inside route files. The corrected backend now keeps every layer explicitly.

```text
server/src/
├── models/             TypeScript model metadata for every former SQLAlchemy model
├── repositories/       Tenant-scoped PostgreSQL data access
├── services/           Business logic and external-provider services
├── controllers/        HTTP controllers; complex compatibility controllers live here
│   └── domain/         Reusable domain CRUD controllers
├── validators/         Zod create/update validation per domain
├── routes/             Thin public route exports
│   └── domain/         Domain router wiring
├── core/               Base repository/service/controller and model infrastructure
├── migrations/         Complete PostgreSQL schema and indexes
└── scripts/            Migration command
```

## Original model coverage

| Former Python model file | TypeScript model file |
|---|---|
| academic.py | models/academic.model.ts |
| assignment.py | models/assignment.model.ts |
| attendance.py | models/attendance.model.ts |
| branding.py | models/branding.model.ts |
| chats.py | models/chats.model.ts |
| communication.py | models/communication.model.ts |
| course.py | models/course.model.ts |
| enrollment.py | models/enrollment.model.ts |
| exam.py | models/exam.model.ts |
| fee.py | models/fee.model.ts |
| homework.py | models/homework.model.ts |
| lesson.py | models/lesson.model.ts |
| library.py | models/library.model.ts |
| meeting.py | models/meeting.model.ts |
| notice.py | models/notice.model.ts |
| people.py | models/people.model.ts |
| progress.py | models/progress.model.ts |
| school.py | models/school.model.ts |
| session.py | models/session.model.ts |
| submission.py | models/submission.model.ts |
| timetable.py | models/timetable.model.ts |
| user.py | models/user.model.ts |
| verification.py | models/verification.model.ts |
| video_watch_progress.py | models/video-watch-progress.model.ts |

The public API compatibility controllers preserve all 255 former endpoint contracts. Generic domain controllers use the same repositories and services for standard CRUD operations. Complex workflows—authentication, bulk attendance, report cards, fees, uploads, streaming AI, meetings, and reports—remain specialized controllers because forcing them through generic CRUD would lose business rules.

FastAPI is separate under `ai-service/` and owns only AI generation. It does not own ERP database models or public authentication.
