"""Request-local database timing used by API observability headers."""

from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass


_db_query_count: ContextVar[int] = ContextVar("db_query_count", default=0)
_db_time_ms: ContextVar[float] = ContextVar("db_time_ms", default=0.0)


@dataclass(frozen=True)
class MetricTokens:
    query_count: Token
    db_time_ms: Token


def begin_request_metrics() -> MetricTokens:
    return MetricTokens(
        query_count=_db_query_count.set(0),
        db_time_ms=_db_time_ms.set(0.0),
    )


def record_db_query(duration_ms: float) -> None:
    _db_query_count.set(_db_query_count.get() + 1)
    _db_time_ms.set(_db_time_ms.get() + duration_ms)


def current_request_metrics() -> tuple[int, float]:
    return _db_query_count.get(), _db_time_ms.get()


def end_request_metrics(tokens: MetricTokens) -> None:
    _db_query_count.reset(tokens.query_count)
    _db_time_ms.reset(tokens.db_time_ms)
