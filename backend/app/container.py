"""Composition root: wires adapters to ports so the rest of the code never builds them."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.adapters.osdr_csv import load_wbc_baseline
from app.adapters.report_sinks import FallbackSink, GitHubIssueSink, SqliteReportSink
from app.adapters.scenario import (
    CREW_SCENARIOS,
    DEMO,
    RepeatingSource,
    Scenario,
    SteppingClock,
)
from app.adapters.simulator import DEFAULT_PROFILES, Simulator
from app.adapters.sqlite_repo import SqliteReadingRepository
from app.application.bus import EventBus
from app.application.crew import Crew, CrewSlot
from app.application.evaluate import EvaluateHealth
from app.application.forecast import ForecastSleep
from app.application.ingest import IngestReadings
from app.application.mission import Mission, synthetic_preflight_baselines
from app.application.radiation import TrackRadiation
from app.application.reports import ReportSink, SubmitReport
from app.config import OSDR_CBC_CSV, Settings
from app.domain.crew import CREW, DEFAULT_CREW_ID, CrewMember
from app.domain.modes import strategy_for
from app.domain.radiation import DoseLedger
from app.domain.readings import Signal
from app.ports.sources import ReadingSource

Clock = Callable[[], datetime]

SEED_STEP = 800
"""Each crew member gets their own seed, so nobody shares another member's readings."""


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class Container:
    settings: Settings
    crew: Crew
    clock: Clock
    reports: SubmitReport
    local_reports: SqliteReportSink
    repositories: tuple[SqliteReadingRepository, ...]
    scenario: Scenario | None = None

    def close(self) -> None:
        for repository in self.repositories:
            repository.close()

    @classmethod
    def build(
        cls, settings: Settings, clock: Clock | None = None, scenario: Scenario | None = None
    ) -> Container:
        if scenario is None and settings.scenario == DEMO.name:
            scenario = DEMO
        if clock is None:
            step = timedelta(seconds=settings.tick_seconds * settings.speed)
            clock = SteppingClock(scenario.start, step) if scenario else utc_now
        start = scenario.start if scenario else clock()
        slots: list[CrewSlot] = []
        repositories: list[SqliteReadingRepository] = []
        for index, member in enumerate(CREW):
            member_scenario = _scenario_for(member, scenario)
            slot, repository = _build_member(
                settings, member, member_scenario, settings.seed + index * SEED_STEP, start
            )
            slots.append(slot)
            repositories.append(repository)
        local_reports = SqliteReportSink(settings.db_path)
        sink: ReportSink = (
            FallbackSink(
                GitHubIssueSink(settings.github_repo, settings.github_token), local_reports
            )
            if settings.github_token
            else local_reports
        )
        return cls(
            settings=settings,
            crew=Crew(slots),
            clock=clock,
            reports=SubmitReport(sink, utc_now),
            local_reports=local_reports,
            repositories=tuple(repositories),
            scenario=scenario,
        )


def _scenario_for(member: CrewMember, scenario: Scenario | None) -> Scenario | None:
    if scenario is not None and scenario.name == DEMO.name:
        return CREW_SCENARIOS.get(member.id, scenario)
    return scenario


def _build_member(
    settings: Settings,
    member: CrewMember,
    scenario: Scenario | None,
    seed: int,
    start: datetime,
) -> tuple[CrewSlot, SqliteReadingRepository]:
    repository = SqliteReadingRepository(settings.db_path, crew=member.id)
    bus = EventBus()
    source: ReadingSource
    if scenario is None:
        source = Simulator(seed=seed)
    else:
        script = scenario
        source = RepeatingSource(
            lambda: Simulator(seed=seed, exam_every=script.exam_every, adjust=script.offset),
            script,
        )
    baselines = synthetic_preflight_baselines(seed=seed + 1, end=start)
    if member.id == DEFAULT_CREW_ID:
        # The commander's white blood cell normal comes from open NASA data (OSD-569).
        wbc_baseline, _ = load_wbc_baseline(OSDR_CBC_CSV)
        baselines[wbc_baseline.signal] = wbc_baseline
    evaluate = EvaluateHealth(baselines, bus, strategy=strategy_for(member.mode))
    ledger = DoseLedger(
        accumulated_msv=member.career_dose_msv,
        usual_rate_msv=DEFAULT_PROFILES[Signal.DOSE_TODAY].mean,
    )
    mission = Mission(
        IngestReadings(source, repository, bus),
        evaluate,
        TrackRadiation(ledger, bus),
        bus,
        ForecastSleep(repository, baselines.get(Signal.SLEEP_HOURS), bus),
        mission_day=scenario.mission_day if scenario else None,
    )
    return CrewSlot(member=member, mission=mission, repository=repository, bus=bus), repository
