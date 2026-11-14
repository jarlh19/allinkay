"""Problem reports from testers."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.application.reports import RateLimitedError
from app.container import Container
from app.domain.reports import MAX_EXPECTED, MAX_TESTER, MAX_WHAT, InvalidReportError, ProblemReport

router = APIRouter()


class ReportIn(BaseModel):
    what_happened: str = Field(min_length=1, max_length=MAX_WHAT)
    expected: str = Field(default="", max_length=MAX_EXPECTED)
    screen: str = Field(default="other", max_length=40)
    tester: str = Field(default="", max_length=MAX_TESTER)
    mission_day: int | None = Field(default=None, ge=0, le=100_000)
    mode: str = Field(default="ship", max_length=10)
    language: str = Field(default="en", max_length=5)


def _sender(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/api/reports", status_code=201)
def create_report(request: Request, body: ReportIn) -> dict[str, Any]:
    container: Container = request.app.state.container
    try:
        report = ProblemReport.create(
            what_happened=body.what_happened,
            expected=body.expected,
            screen=body.screen,
            tester=body.tester,
            mission_day=body.mission_day,
            mode=body.mode,
            language=body.language,
            created_at=datetime.now(UTC),
        )
        reference = container.reports.submit(report, _sender(request))
    except InvalidReportError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RateLimitedError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    return {"reference": reference, "destination": container.reports.destination}


@router.get("/api/reports.md", response_class=PlainTextResponse)
def export_reports(request: Request) -> str:
    container: Container = request.app.state.container
    if not container.settings.reports_export:
        raise HTTPException(status_code=404, detail="Not found")
    return container.local_reports.export_markdown()
