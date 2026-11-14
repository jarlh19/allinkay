"""A small sample of the model's two kinds of error, on every change.

The full measurement (200 people x 90 days, with rates per astronaut-year) runs with
`python validate_model.py` in backend/. These tests use the same loop on fewer people so a
regression is caught in CI: before D-011, 20 of 20 healthy people got a false alarm here.
"""

from __future__ import annotations

from app.adapters.scenario import CREW_SCENARIOS
from app.domain.modes import Mode
from validate_model import run, scripted_signals


def false_alarms(mode: Mode, people: int = 20, days: int = 30) -> int:
    return sum(sum(run(seed, days, mode, scenario=None)[1].values()) for seed in range(people))


def test_healthy_people_almost_never_get_a_false_alarm_in_the_ship() -> None:
    assert false_alarms(Mode.SHIP) <= 1


def test_healthy_people_get_no_false_alarm_in_the_field() -> None:
    assert false_alarms(Mode.FIELD) == 0


def test_the_commander_script_is_detected_within_the_lap() -> None:
    scenario = CREW_SCENARIOS["commander"]
    expected = scripted_signals(scenario)
    missed = 0
    for seed in range(20):
        first, _ = run(seed, 10, Mode.SHIP, scenario)
        missed += len(expected - set(first))

    assert missed <= 1
