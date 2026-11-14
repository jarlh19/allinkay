"""Problem reports sent by testers from inside the app."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

MAX_WHAT = 2000
MAX_EXPECTED = 1000
MAX_TESTER = 40
MAX_CREW = 40

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class Screen(StrEnum):
    OVERALL = "overall"
    CARDIOVASCULAR = "cardiovascular"
    NEUROLOGICAL = "neurological"
    IMMUNE = "immune"
    ENVIRONMENT = "environment"
    MODEL = "model"
    RADIATION = "radiation"
    ACTIONS = "actions"
    OTHER = "other"


class InvalidReportError(ValueError):
    """A report that cannot be accepted as written."""


def _clean(text: str, limit: int, field: str, required: bool) -> str:
    cleaned = _CONTROL.sub("", text).strip()
    if required and not cleaned:
        raise InvalidReportError(f"{field} is required")
    if len(cleaned) > limit:
        raise InvalidReportError(f"{field} is longer than {limit} characters")
    return cleaned


@dataclass(frozen=True)
class ProblemReport:
    what_happened: str
    expected: str
    screen: Screen
    tester: str
    mission_day: int | None
    mode: str
    language: str
    created_at: datetime
    crew: str = ""

    @classmethod
    def create(
        cls,
        what_happened: str,
        expected: str,
        screen: str,
        tester: str,
        mission_day: int | None,
        mode: str,
        language: str,
        created_at: datetime,
        crew: str = "",
    ) -> ProblemReport:
        try:
            known_screen = Screen(screen)
        except ValueError as error:
            raise InvalidReportError(f"Unknown screen: {screen!r}") from error
        return cls(
            what_happened=_clean(what_happened, MAX_WHAT, "what_happened", required=True),
            expected=_clean(expected, MAX_EXPECTED, "expected", required=False),
            screen=known_screen,
            tester=_clean(tester, MAX_TESTER, "tester", required=False),
            mission_day=mission_day,
            mode=mode if mode in {"ship", "field"} else "ship",
            language=language if language in {"en", "es"} else "en",
            created_at=created_at,
            crew=_clean(crew, MAX_CREW, "crew", required=False),
        )

    @property
    def title(self) -> str:
        summary = " ".join(self.what_happened.split())
        if len(summary) > 60:
            summary = summary[:57] + "..."
        return f"[Tester report] {self.screen.value}: {summary}"

    def to_markdown(self) -> str:
        day = str(self.mission_day) if self.mission_day is not None else "unknown"
        lines = [
            f"**Screen:** {self.screen.value}",
            f"**Crew member:** {self.crew or 'not given'}",
            f"**Mission day:** {day}",
            f"**Mode:** {self.mode}",
            f"**Language:** {self.language}",
            f"**Tester:** {self.tester or 'not given'}",
            f"**Sent at:** {self.created_at.isoformat()}",
            "",
            "### What happened",
            self.what_happened,
            "",
            "### What was expected",
            self.expected or "not given",
        ]
        return "\n".join(lines)
