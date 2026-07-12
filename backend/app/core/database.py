import logging
import time

from sqlalchemy import create_engine, event
from sqlalchemy.pool import NullPool
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.core.request_metrics import record_db_query


logger = logging.getLogger(__name__)


DEFAULT_ASYNC_SQLITE_URL = "sqlite+aiosqlite:///./erp_phase1.db"


def _normalize_sync_database_url(raw_url: str) -> str:
    url = make_url(raw_url)

    if url.drivername == "postgresql+asyncpg":
        return url.set(
            drivername="postgresql+psycopg"
        ).render_as_string(hide_password=False)

    if url.drivername == "postgresql":
        return url.set(
            drivername="postgresql+psycopg"
        ).render_as_string(hide_password=False)

    if url.drivername == "sqlite+aiosqlite":
        return url.set(
            drivername="sqlite"
        ).render_as_string(hide_password=False)

    return raw_url


def _normalize_async_database_url(raw_url: str) -> str:
    url = make_url(raw_url)

    if url.drivername in {
        "postgresql",
        "postgresql+psycopg",
        "postgresql+psycopg2",
    }:
        return url.set(
            drivername="postgresql+asyncpg"
        ).render_as_string(hide_password=False)

    if url.drivername == "sqlite":
        return url.set(
            drivername="sqlite+aiosqlite"
        ).render_as_string(hide_password=False)

    return raw_url


raw_async_database_url = settings.ASYNC_DATABASE_URL

if (
    settings.DATABASE_URL
    and not settings.DATABASE_URL.startswith("sqlite")
    and raw_async_database_url == DEFAULT_ASYNC_SQLITE_URL
):
    raw_async_database_url = settings.DATABASE_URL


SYNC_DATABASE_URL = _normalize_sync_database_url(settings.DATABASE_URL)
ASYNC_DATABASE_URL = _normalize_async_database_url(raw_async_database_url)


# ----------------------------------------------------------------------
# Sync engine
# ----------------------------------------------------------------------

def _pool_options() -> dict:
    """Shared bounded-pool settings for long-running API processes.

    NullPool is still available for short-lived/serverless jobs, but it should
    not be the default for a persistent API connected to a remote database.
    """
    if settings.DB_USE_NULL_POOL:
        return {"poolclass": NullPool}
    return {
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
        "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
    }


def _install_query_timing(target) -> None:
    @event.listens_for(target, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start_times", []).append(time.perf_counter())

    @event.listens_for(target, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        starts = conn.info.get("query_start_times") or []
        if not starts:
            return
        duration_ms = (time.perf_counter() - starts.pop()) * 1000
        record_db_query(duration_ms)
        if duration_ms >= settings.DB_SLOW_QUERY_MS:
            compact_sql = " ".join(str(statement).split())[:500]
            logger.warning("SLOW DB %.1fms %s", duration_ms, compact_sql)


if SYNC_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SYNC_DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(
        SYNC_DATABASE_URL,
        **_pool_options(),
        pool_pre_ping=True,
        connect_args={"connect_timeout": settings.DB_CONNECT_TIMEOUT_SECONDS},
        echo=False,
    )

_install_query_timing(engine)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------------------------------------------------------------
# Async engine
# ----------------------------------------------------------------------

if ASYNC_DATABASE_URL.startswith("sqlite"):
    async_engine = create_async_engine(
        ASYNC_DATABASE_URL,
        echo=False,
    )
else:
    async_engine = create_async_engine(
        ASYNC_DATABASE_URL,
        **_pool_options(),
        pool_pre_ping=True,
        connect_args={
            "timeout": settings.DB_CONNECT_TIMEOUT_SECONDS,
            "command_timeout": settings.DB_COMMAND_TIMEOUT_SECONDS,
            "prepared_statement_cache_size": settings.DB_ASYNCPG_PREPARED_STATEMENT_CACHE_SIZE,
        },
        echo=False,
    )

_install_query_timing(async_engine.sync_engine)


AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_db():
    async with AsyncSessionLocal() as db:
        yield db


async def get_session_factory():
    return AsyncSessionLocal
