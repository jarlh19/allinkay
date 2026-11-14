"""Crew members: each one has their own normal, their own alerts and their own place (ship or
field). The id is stable and goes in the URL; the role is what the screen shows."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.modes import Mode

DEFAULT_CREW_ID = "commander"

_ID = re.compile(r"^[a-z][a-z0-9-]{1,30}$")


class UnknownCrewMemberError(LookupError):
    """No crew member with that id."""


@dataclass(frozen=True)
class CrewMember:
    id: str
    role: str
    mode: Mode
    career_dose_msv: float

    def __post_init__(self) -> None:
        if not _ID.match(self.id):
            raise ValueError(f"Crew id must be a lowercase slug, got {self.id!r}")
        if self.career_dose_msv < 0:
            raise ValueError("Career dose cannot be negative")


CREW: tuple[CrewMember, ...] = (
    CrewMember(id="commander", role="commander", mode=Mode.SHIP, career_dose_msv=256.0),
    CrewMember(id="engineer", role="engineer", mode=Mode.FIELD, career_dose_msv=212.0),
    CrewMember(id="scientist", role="scientist", mode=Mode.SHIP, career_dose_msv=148.0),
)
"""A three-person crew with synthetic histories: the commander stays in the ship, the flight
engineer works outside (field mode, portable sensors only) and the scientist stays in the ship."""
