"""Use case: accept a tester's report, with limits so the public form cannot be abused."""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from app.domain.reports import ProblemReport


class ReportSink(Protocol):
    destination: str

    def submit(self, report: ProblemReport) -> str: ...


class RateLimitedError(RuntimeError):
    """Too many reports; try again later."""


@dataclass(frozen=True)
class Limits:
    per_sender: int = 5
    sender_window: timedelta = timedelta(minutes=10)
    total: int = 100
    total_window: timedelta = timedelta(days=1)


class SubmitReport:
    def __init__(
        self, sink: ReportSink, clock: Callable[[], datetime], limits: Limits | None = None
    ) -> None:
        self._sink = sink
        self._clock = clock
        self._limits = limits or Limits()
        self._by_sender: dict[str, deque[datetime]] = {}
        self._all: deque[datetime] = deque()

    @property
    def destination(self) -> str:
        return self._sink.destination

    def submit(self, report: ProblemReport, sender: str) -> str:
        now = self._clock()
        sent = self._by_sender.setdefault(sender, deque())
        _forget_before(sent, now - self._limits.sender_window)
        _forget_before(self._all, now - self._limits.total_window)
        if len(sent) >= self._limits.per_sender or len(self._all) >= self._limits.total:
            raise RateLimitedError("Too many reports, try again in a few minutes")
        reference = self._sink.submit(report)
        sent.append(now)
        self._all.append(now)
        return reference


def _forget_before(times: deque[datetime], cutoff: datetime) -> None:
    while times and times[0] < cutoff:
        times.popleft()
