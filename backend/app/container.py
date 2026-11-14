"""Composition root: wires adapters to ports so the rest of the code never builds them."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from app.adapters.osdr_csv import load_wbc_baseline
from app.adapters.simulator import DEFAULT_PROFILES, Simulator
from app.adapters.sqlite_repo import SqliteReadingRepository
from app.application.bus import EventBus
from app.application.evaluate import EvaluateHealth
from app.application.ingest import IngestReadings
from app.application.mission import Mission, synthetic_preflight_baselines
from app.application.radiation import TrackRadiation
from app.config import OSDR_CBC_CSV, Settings
from app.domain.radiation import DoseLedger
from app.domain.readings import Signal

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class Container:
    settings: Settings
    repository: SqliteReadingRepository
    bus: EventBus
    mission: Mission
    clock: Clock

    @property
    def ingest(self) -> IngestReadings:
        return self.mission.ingest

    @property
    def evaluate(self) -> EvaluateHealth:
        return self.mission.evaluate

    @property
    def radiation(self) -> TrackRadiation:
        return self.mission.radiation

    @classmethod
    def build(cls, settings: Settings, clock: Clock = utc_now) -> Container:
        repository = SqliteReadingRepository(settings.db_path)
        bus = EventBus()
        ingest = IngestReadings(Simulator(seed=settings.seed), repository, bus)
        baselines = synthetic_preflight_baselines(seed=settings.seed + 1, end=clock())
        wbc_baseline, _ = load_wbc_baseline(OSDR_CBC_CSV)
        baselines[wbc_baseline.signal] = wbc_baseline
        evaluate = EvaluateHealth(baselines, bus)
        ledger = DoseLedger(
            accumulated_msv=settings.career_dose_msv,
            usual_rate_msv=DEFAULT_PROFILES[Signal.DOSE_TODAY].mean,
        )
        radiation = TrackRadiation(ledger, bus)
        return cls(
            settings=settings,
            repository=repository,
            bus=bus,
            mission=Mission(ingest, evaluate, radiation),
            clock=clock,
        )
