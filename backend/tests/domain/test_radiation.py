from datetime import UTC, datetime, timedelta

import pytest

from app.domain.radiation import (
    CAREER_LIMIT_MSV,
    EVENT_LIMIT_MSV,
    ORGANS_AT_RISK,
    DoseLedger,
    Timeframe,
    days_to_limit,
)

START = datetime(2026, 11, 14, 0, 0, tzinfo=UTC)


def test_nasa_limits() -> None:
    assert CAREER_LIMIT_MSV == 600
    assert EVENT_LIMIT_MSV == 250


def test_days_to_the_career_limit_at_the_mars_cruise_rate() -> None:
    assert days_to_limit(256, 1.8) == 191


def test_days_to_limit_edge_cases() -> None:
    assert days_to_limit(600, 1.8) == 0
    assert days_to_limit(700, 1.8) == 0
    assert days_to_limit(256, 0) is None


def test_ledger_integrates_the_rate_over_a_day() -> None:
    ledger = DoseLedger(accumulated_msv=256, usual_rate_msv=1.8)

    ledger.record(1.8, START)
    ledger.record(1.8, START + timedelta(days=1))

    assert ledger.accumulated_msv == pytest.approx(257.8)
    assert ledger.days_to_limit == 190
    assert not ledger.storm_active


def test_a_dose_rate_spike_is_a_solar_storm_and_its_dose_is_counted() -> None:
    ledger = DoseLedger(accumulated_msv=256, usual_rate_msv=1.8)
    ledger.record(1.8, START)
    ledger.record(120, START + timedelta(hours=1))

    ledger.record(120, START + timedelta(hours=7))

    assert ledger.storm_active
    assert ledger.storm_dose_msv == pytest.approx(30.0)


def test_storm_dose_resets_when_the_storm_ends() -> None:
    ledger = DoseLedger(accumulated_msv=0, usual_rate_msv=1.8)
    ledger.record(120, START)
    ledger.record(120, START + timedelta(hours=6))

    ledger.record(1.8, START + timedelta(hours=7))

    assert not ledger.storm_active
    assert ledger.storm_dose_msv == 0


def test_every_timeframe_has_an_organ_at_risk() -> None:
    assert {o.timeframe for o in ORGANS_AT_RISK} == set(Timeframe)
