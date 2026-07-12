from pathlib import Path
import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import Base, async_engine, engine
from app.core.migrations import run_phase4_migrations, run_startup_migrations
from app.core.redis import init_redis, close_redis, get_redis
from app.core.request_metrics import begin_request_metrics, current_request_metrics, end_request_metrics
from app.models import (  # noqa: F401
    AcademicSession,
    ClassTeacherAssignment,
    Department,
    HomeworkAssignment,
    HomeworkSubmission,
    TimetableDay,
    TimetableEntry,
    TimetablePeriod,
    Exam,
    ExamMark,
    ExamSubject,
    FeeAssignment,
    FeeCategory,
    FeeExpense,
    FeePayment,
    FeeStructure,
    StudentFeeRecord,
    ParentGuardian,
    School,
    SchoolBranding,
    SchoolClass,
    Section,
    Student,
    Subject,
    Teacher,
    TeacherSubject,
    User,
    RefreshToken,
    PendingSchoolRegistration,
    Announcement,
    Complaint,
    InAppNotification,
    InAppNotificationRead,
    SchoolEvent,
)

from app.routes import (
    academic, attendance, reports, auth, dashboard, exams, fees, homework,
    people, schools, library, timetable, notice, communication, curriculum,
    meetings, assignments, chats, courses, enrollments, lessons, progress,
)

# from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import get_async_db
from app.services.meeting_service import sync_live_meetings

if settings.RUN_STARTUP_MIGRATIONS:
    Base.metadata.create_all(bind=engine)
    run_startup_migrations(engine)

app = FastAPI(title="School ERP Phase 9 API", version="9.0.0")

#schedular for meeting
# add it after deploying db to aws cause it needs ipv4 and 
# Enable this only after the meeting provider and deployment network are configured.
# scheduler = AsyncIOScheduler()

# @app.on_event("startup")
# async def start_scheduler():
#     scheduler.add_job(
#         sync_live_meetings,
#         "interval",
#         minutes=5,
#     )
#     scheduler.start()

# @app.on_event("shutdown")
# async def stop_scheduler():
#     scheduler.stop()

@app.get("/health", tags=["Health"])
async def health():
    """
    Liveness check for Docker HEALTHCHECK and the AWS ALB target group.
    Intentionally does NOT touch the database or Redis — a slow/degraded
    DB shouldn't cause the ALB to kill and restart a otherwise-healthy
    container. Keep this fast and dependency-free.
    """
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
async def readiness():
    """Readiness check for deployments and smoke tests."""
    try:
        async with async_engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        logging.exception("Database readiness check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    redis = get_redis()
    redis_status = "connected" if redis is not None else "unavailable"
    if settings.REDIS_REQUIRED and redis is None:
        raise HTTPException(status_code=503, detail="Redis unavailable")

    return {"status": "ready", "database": "connected", "redis": redis_status}

@app.middleware("http")
async def log_request_time(request: Request, call_next):
    start = time.perf_counter()
    metric_tokens = begin_request_metrics()
    try:
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        db_query_count, db_time_ms = current_request_metrics()
        response.headers["X-Process-Time-ms"] = str(round(duration_ms, 1))
        response.headers["X-DB-Time-ms"] = str(round(db_time_ms, 1))
        response.headers["X-DB-Query-Count"] = str(db_query_count)
        response.headers["Server-Timing"] = f'app;dur={duration_ms:.1f}, db;dur={db_time_ms:.1f}'
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        log_message = "%s %s %.1fms db=%.1fms queries=%s" % (
            request.method,
            request.url.path,
            duration_ms,
            db_time_ms,
            db_query_count,
        )
        if duration_ms >= settings.API_SLOW_LOG_MS:
            logging.warning("SLOW API %s", log_message)
        else:
            logging.info("API %s", log_message)

        return response
    finally:
        end_request_metrics(metric_tokens)

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Server-Timing", "X-Process-Time-ms", "X-DB-Time-ms", "X-DB-Query-Count"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ---------------------------------------------------------------------------
# Redis lifecycle — graceful degradation if Redis is unavailable
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event() -> None:
    await init_redis()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_redis()


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(schools.router)
app.include_router(academic.router)
app.include_router(people.router)
app.include_router(dashboard.router)
app.include_router(notice.router)
app.include_router(communication.router)
app.include_router(attendance.router)
app.include_router(homework.router)
app.include_router(timetable.router)
app.include_router(exams.router)
app.include_router(fees.router)
app.include_router(library.router)
app.include_router(reports.router)
app.include_router(curriculum.router)
app.include_router(meetings.router)
app.include_router(assignments.router)
app.include_router(chats.router)
app.include_router(courses.router)
app.include_router(enrollments.router)
app.include_router(lessons.router)
app.include_router(progress.router)
