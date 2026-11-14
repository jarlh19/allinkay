from datetime import UTC, datetime

import pytest

from app.domain.baseline import (
    CONCERN,
    Baseline,
    BaselineError,
    Deviation,
    baselines_from_readings,
    deviation,
)
from app.domain.readings import Reading, Signal, System
from app.domain.references import REFERENCES, SIGNAL_EVIDENCE, Ref
from app.domain.rules import (
    AlertKind,
    CombinedPatternRule,
    Level,
    OutsideNormalRule,
    evaluate_rules,
)

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def reading(signal: str, value: float) -> Reading:
    return Reading.create(signal, value, NOW, "test")


def test_baseline_mean_and_sample_sd() -> None:
    baseline = Baseline.from_values(Signal.SLEEP_HOURS, [7.0, 7.5, 8.0], "test")

    assert baseline.mean == pytest.approx(7.5)
    assert baseline.sd == pytest.approx(0.5)
    assert baseline.low == pytest.approx(6.75)
    assert baseline.high == pytest.approx(8.25)


def test_a_very_stable_baseline_uses_the_minimum_spread() -> None:
    baseline = Baseline.from_values(Signal.HEART_RATE, [68, 68, 68], "test")

    assert baseline.sd == 2.0


def test_baseline_needs_two_values() -> None:
    with pytest.raises(BaselineError, match="at least 2"):
        Baseline.from_values(Signal.GLUCOSE, [90], "test")


def test_z_score_against_the_personal_normal() -> None:
    baseline = Baseline.from_values(Signal.SLEEP_HOURS, [7.0, 7.5, 8.0], "test")

    low = deviation(reading("sleep_hours", 5.17), baseline)
    usual = deviation(reading("sleep_hours", 7.2), baseline)

    assert low.z_score == pytest.approx(-4.66)
    assert low.outside_normal
    assert low.direction == "below"
    assert not usual.outside_normal


def test_white_blood_cells_inside_the_general_range_can_be_below_your_normal() -> None:
    # Pre-flight values of an Inspiration4 crew member (NASA OSDR, OSD-569).
    baseline = Baseline.from_values(Signal.WHITE_BLOOD_CELLS, [5.4, 5.5, 7.0], "OSD-569")

    dev = deviation(reading("white_blood_cells", 4.4), baseline)

    assert 3.8 <= 4.4 <= 10.8
    assert dev.z_score == pytest.approx(-1.75, abs=0.01)
    assert dev.outside_normal


def test_deviation_rejects_a_baseline_of_another_signal() -> None:
    baseline = Baseline.from_values(Signal.GLUCOSE, [90, 95], "test")

    with pytest.raises(BaselineError, match="cannot evaluate"):
        deviation(reading("heart_rate", 70), baseline)


def test_baselines_from_readings_groups_by_signal_and_skips_single_values() -> None:
    readings = [reading("heart_rate", v) for v in (66, 70)] + [reading("glucose", 92)]

    baselines = baselines_from_readings(readings, "pre-flight")

    assert set(baselines) == {Signal.HEART_RATE}
    assert baselines[Signal.HEART_RATE].mean == 68


def deviations_for(values: dict[str, float]) -> list[Deviation]:
    sources = {
        "sleep_hours": [7.0, 7.5, 8.0],
        "reaction_time": [260, 270, 280],
        "white_blood_cells": [5.4, 5.5, 7.0],
        "systolic_bp": [114, 116, 118],
        "diastolic_bp": [74, 75, 76],
    }
    return [
        deviation(reading(name, value), Baseline.from_values(Signal(name), sources[name], "t"))
        for name, value in values.items()
    ]


def test_outside_normal_rule_explains_each_signal() -> None:
    devs = deviations_for({"sleep_hours": 5.17, "reaction_time": 275})

    alerts = OutsideNormalRule().evaluate(devs)

    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.kind is AlertKind.OUTSIDE_NORMAL
    assert alert.level is Level.ATTENTION
    assert alert.reference is Ref.SLEEP
    assert alert.action == "action.sleep_and_workload"
    evidence = alert.evidence[0]
    assert (evidence.signal, evidence.value, evidence.unit) == (Signal.SLEEP_HOURS, 5.17, "h")
    assert (evidence.normal_low, evidence.normal_high) == (6.75, 8.25)


def test_combined_pattern_needs_two_different_systems() -> None:
    same_system = deviations_for({"systolic_bp": 135, "diastolic_bp": 90})
    two_systems = deviations_for(
        {"sleep_hours": 5.17, "reaction_time": 330, "white_blood_cells": 4.4}
    )

    assert CombinedPatternRule().evaluate(same_system) == []
    [alert] = CombinedPatternRule().evaluate(two_systems)
    assert alert.kind is AlertKind.COMBINED_PATTERN
    assert set(alert.systems) == {System.NEUROLOGICAL, System.IMMUNE}
    assert set(alert.signals) == {
        Signal.SLEEP_HOURS,
        Signal.REACTION_TIME,
        Signal.WHITE_BLOOD_CELLS,
    }
    assert alert.reference is Ref.SLEEP


def test_evaluate_rules_runs_every_rule() -> None:
    devs = deviations_for({"sleep_hours": 5.17, "white_blood_cells": 4.4})

    alerts = evaluate_rules([OutsideNormalRule(), CombinedPatternRule()], devs)

    assert [a.kind for a in alerts] == [
        AlertKind.OUTSIDE_NORMAL,
        AlertKind.OUTSIDE_NORMAL,
        AlertKind.COMBINED_PATTERN,
    ]


def test_every_signal_cites_a_known_reference() -> None:
    assert set(SIGNAL_EVIDENCE) == set(Signal)
    assert all(ref in REFERENCES for ref in SIGNAL_EVIDENCE.values())


def test_only_the_concerning_side_counts_as_outside_normal() -> None:
    sleep = Baseline.from_values(Signal.SLEEP_HOURS, [7.0, 7.5, 8.0], "t")
    heart = Baseline.from_values(Signal.HEART_RATE, [66, 68, 70], "t")

    assert not deviation(reading("sleep_hours", 9.9), sleep).outside_normal
    assert deviation(reading("sleep_hours", 5.0), sleep).outside_normal
    assert deviation(reading("heart_rate", 95), heart).outside_normal
    assert deviation(reading("heart_rate", 45), heart).outside_normal


def test_every_signal_has_a_concern_direction() -> None:
    assert set(CONCERN) == set(Signal)
