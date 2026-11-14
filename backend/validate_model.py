"""Measure the model's two kinds of error on synthetic people (no real person's data).

- False alarm: an alert for a change that did not happen (a healthy person, or a signal that a
  crew member's script does not touch). Reported per astronaut-year, for the ship and the field
  separately; the target applies to each, so the field cannot dilute the ship.
- Miss: a change written in a crew member's demo script that raises no alert within the lap
  (10 days). A persistent change missed in the lap is still caught by later readings.

Neither error can be zero with finite data: lowering one raises the other. The targets below
were chosen with Jorge on 14 November 2026 (D-011), favouring not missing real changes.

Usage (from backend/): python validate_model.py [--people 200] [--days 90]
Exits with status 1 when a target is not met, so it can gate a release.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import UTC, datetime, timedelta

from app.adapters.scenario import CREW_SCENARIOS, DEMO, Scenario
from app.adapters.simulator import Simulator
from app.application.bus import EventBus
from app.application.evaluate import EvaluateHealth
from app.application.mission import REPEAT_AFTER, synthetic_preflight_baselines
from app.domain.crew import CREW
from app.domain.modes import Mode, strategy_for
from app.domain.readings import Signal

START = datetime(2026, 11, 14, tzinfo=UTC)
MAX_FALSE_ALARMS_PER_YEAR = 0.1
"""At most one false alarm every ten astronaut-years."""
MAX_MISS_RATE = 0.01
"""At most 1% of scripted changes undetected within the 10-day lap."""
NOT_EVALUATED = {Signal.DOSE_TODAY}
"""The dose has its own deterministic storm rule (dose rate against the usual rate)."""


def run(
    seed: int, days: int, mode: Mode, scenario: Scenario | None
) -> tuple[dict[Signal, float], Counter[Signal]]:
    """Day of the first alert per signal and the number of alert episodes per signal,
    running the same loop as the mission (unusual exams are repeated the next day)."""
    simulator = Simulator(
        seed=seed,
        exam_every=(scenario or DEMO).exam_every,
        adjust=scenario.offset if scenario else None,
    )
    health = EvaluateHealth(
        synthetic_preflight_baselines(seed=seed + 1, end=START),
        EventBus(),
        strategy=strategy_for(mode),
    )
    first: dict[Signal, float] = {}
    episodes: Counter[Signal] = Counter()
    active: set[Signal] = set()
    for hour in range(days * 24):
        at = START + timedelta(hours=hour)
        readings = simulator.read(at)
        if not readings:
            continue
        now = {signal for alert in health.on_readings(readings) for signal in alert.signals}
        for signal in now - active:
            first.setdefault(signal, hour / 24)
            episodes[signal] += 1
        active = now
        for signal in health.take_repeat_requests():
            simulator.request_exam(signal, at + REPEAT_AFTER)
    return first, episodes


def scripted_signals(scenario: Scenario) -> set[Signal]:
    return {d.signal for d in scenario.drifts} - NOT_EVALUATED


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--people", type=int, default=200)
    parser.add_argument("--days", type=int, default=90)
    args = parser.parse_args()
    false_alarms: Counter[Mode] = Counter()
    person_days: Counter[Mode] = Counter()
    misses = 0
    scripted = 0

    for mode in (Mode.SHIP, Mode.FIELD):
        by_signal: Counter[str] = Counter()
        for seed in range(10_000, 10_000 + args.people):
            _, episodes = run(seed, args.days, mode, scenario=None)
            by_signal.update({s.value: n for s, n in episodes.items()})
        count = sum(by_signal.values())
        false_alarms[mode] += count
        person_days[mode] += args.people * args.days
        print(
            f"Healthy, {mode.value}: {args.people} people x {args.days} days, "
            f"false alarms {count} {dict(by_signal) or ''}"
        )

    for member in CREW:
        scenario = CREW_SCENARIOS[member.id]
        expected = scripted_signals(scenario)
        lap = int(scenario.cycle_days or 10)
        detected_on: dict[Signal, list[float]] = {s: [] for s in expected}
        missed: Counter[str] = Counter()
        unexpected: Counter[str] = Counter()
        for seed in range(20_000, 20_000 + args.people):
            first, episodes = run(seed, lap, member.mode, scenario)
            for signal in expected:
                if signal in first:
                    detected_on[signal].append(first[signal])
                else:
                    missed[signal.value] += 1
            unexpected.update({s.value: n for s, n in episodes.items() if s not in expected})
        misses += sum(missed.values())
        scripted += len(expected) * args.people
        false_alarms[member.mode] += sum(unexpected.values())
        person_days[member.mode] += args.people * lap
        detail = ", ".join(
            f"{s.value} day {min(d):.1f}-{max(d):.1f}" if d else f"{s.value} never"
            for s, d in sorted(detected_on.items())
        )
        print(
            f"Script {member.id} ({member.mode.value}), {args.people} people: {detail or '-'}; "
            f"missed {dict(missed) or 0}; false alarms {dict(unexpected) or 0}"
        )

    rates = {}
    for mode in (Mode.SHIP, Mode.FIELD):
        years = person_days[mode] / 365.25
        rates[mode] = false_alarms[mode] / years
        print(
            f"False alarms in the {mode.value}: {false_alarms[mode]} in {years:.0f} "
            f"astronaut-years = {rates[mode]:.3f} per year (target <= {MAX_FALSE_ALARMS_PER_YEAR})"
        )
    rate = max(rates.values())
    miss_rate = misses / scripted if scripted else 0.0
    print(
        f"Missed changes: {misses} of {scripted} = {miss_rate:.2%} (target <= {MAX_MISS_RATE:.0%})"
    )
    passed = rate <= MAX_FALSE_ALARMS_PER_YEAR and miss_rate <= MAX_MISS_RATE
    print("PASS" if passed else "FAIL")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
