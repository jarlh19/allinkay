from datetime import UTC, datetime, timedelta
from statistics import mean

import pytest

from app.adapters.simulator import DEFAULT_PROFILES, Simulator
from app.domain.readings import SPECS, Frequency, Signal

START = datetime(2026, 11, 14, 0, 0, tzinfo=UTC)


def run(simulator: Simulator, ticks: int, step: timedelta) -> list[list[tuple[str, float]]]:
    return [
        [(r.signal.value, r.value) for r in simulator.read(START + step * i)] for i in range(ticks)
    ]


def test_same_seed_gives_the_same_sequence() -> None:
    first = run(Simulator(seed=42), ticks=50, step=timedelta(hours=1))
    second = run(Simulator(seed=42), ticks=50, step=timedelta(hours=1))

    assert first == second


def test_different_seeds_give_different_sequences() -> None:
    first = run(Simulator(seed=1), ticks=10, step=timedelta(hours=1))
    second = run(Simulator(seed=2), ticks=10, step=timedelta(hours=1))

    assert first != second


def test_live_signals_come_every_tick_and_daily_and_exam_only_when_due() -> None:
    simulator = Simulator(seed=7)
    counts: dict[Signal, int] = dict.fromkeys(Signal, 0)

    for hour in range(24 * 7):
        for reading in simulator.read(START + timedelta(hours=hour)):
            counts[reading.signal] += 1

    for signal, spec in SPECS.items():
        expected = {Frequency.LIVE: 24 * 7, Frequency.DAILY: 7, Frequency.EXAM: 1}[spec.frequency]
        assert counts[signal] == expected, signal


def test_values_stay_possible_and_close_to_their_profile() -> None:
    simulator = Simulator(seed=3)
    values: dict[Signal, list[float]] = {signal: [] for signal in Signal}

    for minute in range(2000):
        for reading in simulator.read(START + timedelta(minutes=minute)):
            values[reading.signal].append(reading.value)

    for signal, spec in SPECS.items():
        if spec.frequency is not Frequency.LIVE:
            continue
        observed = values[signal]
        assert all(spec.min_possible <= v <= spec.max_possible for v in observed), signal
        profile = DEFAULT_PROFILES[signal]
        assert mean(observed) == pytest.approx(profile.mean, abs=max(profile.sd * 0.2, 0.05))


def test_missing_profile_is_rejected() -> None:
    profiles = {k: v for k, v in DEFAULT_PROFILES.items() if k is not Signal.GLUCOSE}

    with pytest.raises(ValueError, match="glucose"):
        Simulator(seed=1, profiles=profiles)
