"""The crew: one mission per member on the same clock, plus a summary of everyone."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from app.application.bus import EventBus
from app.application.mission import Mission
from app.domain.crew import CrewMember, UnknownCrewMemberError
from app.domain.modes import Mode
from app.domain.rules import Level
from app.ports.repository import ReadingRepository


@dataclass(frozen=True)
class CrewSlot:
    """Everything that belongs to one crew member: their readings, model and live channel."""

    member: CrewMember
    mission: Mission
    repository: ReadingRepository
    bus: EventBus


class Crew:
    def __init__(self, slots: Sequence[CrewSlot]) -> None:
        if not slots:
            raise ValueError("A crew needs at least one member")
        ids = [slot.member.id for slot in slots]
        if len(set(ids)) != len(ids):
            raise ValueError(f"Crew ids must be unique, got {ids}")
        self._slots = {slot.member.id: slot for slot in slots}
        self._default = slots[0]
        self._last_summary: dict[str, Any] | None = None

    def __iter__(self) -> Iterator[CrewSlot]:
        return iter(self._slots.values())

    @property
    def default(self) -> CrewSlot:
        return self._default

    def get(self, crew_id: str) -> CrewSlot:
        try:
            return self._slots[crew_id]
        except KeyError as error:
            raise UnknownCrewMemberError(crew_id) from error

    def step(self, at: datetime) -> None:
        for slot in self:
            slot.mission.step(at)
        self.publish_summary()

    def set_mode(self, crew_id: str, mode: Mode) -> Mode:
        evaluate = self.get(crew_id).mission.evaluate
        evaluate.set_mode(mode)
        self.publish_summary()
        return evaluate.mode

    def summary(self) -> dict[str, Any]:
        return {"type": "crew", "members": [_member_view(slot) for slot in self]}

    def publish_summary(self) -> None:
        """Tell every live channel about the crew, only when something changed."""
        summary = self.summary()
        if summary == self._last_summary:
            return
        self._last_summary = summary
        for slot in self:
            slot.bus.publish(summary)


def _member_view(slot: CrewSlot) -> dict[str, Any]:
    alerts = slot.mission.evaluate.alerts
    if any(alert.level is Level.EMERGENCY for alert in alerts):
        status = "emergency"
    elif alerts:
        status = "attention"
    else:
        status = "normal"
    return {
        "id": slot.member.id,
        "role": slot.member.role,
        "mode": slot.mission.evaluate.mode.value,
        "status": status,
        "alerts": len(alerts),
    }
