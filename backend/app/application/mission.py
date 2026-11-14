"""The mission loop: each step ingests what is due and evaluates it against the person's normal."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.adapters.simulator import Simulator
from app.application.evaluate import EvaluateHealth
from app.application.ingest import IngestReadings
from app.domain.baseline import Baseline, baselines_from_readings
from app.domain.readings import Reading, Signal

PREFLIGHT_SOURCE = "pre-flight (synthetic)"


class Mission:
    def __init__(self, ingest: IngestReadings, evaluate: EvaluateHealth) -> None:
        self.ingest = ingest
        self.evaluate = evaluate

    def step(self, at: datetime) -> list[Reading]:
        readings = self.ingest.tick(at)
        if readings:
            self.evaluate.on_readings(readings)
        return readings


def synthetic_preflight_baselines(
    seed: int, end: datetime, days: int = 14, step: timedelta = timedelta(hours=1)
) -> dict[Signal, Baseline]:
    """A pre-flight reference period generated with its own seed (no real person's data)."""
    simulator = Simulator(seed=seed)
    start = end - timedelta(days=days)
    readings: list[Reading] = []
    at = start
    while at < end:
        readings.extend(simulator.read(at))
        at += step
    return baselines_from_readings(readings, PREFLIGHT_SOURCE)
