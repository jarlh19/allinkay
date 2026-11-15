from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.adapters.rad_csv import (
    SOURCE,
    DoseReplay,
    RadDataError,
    RadObservation,
    ReplayedDose,
    calibrate,
    load_rad_observations,
)
from app.config import RAD_DOSE_CSV
from app.domain.radiation import DoseEquivalent
from app.domain.readings import Reading, Signal

T0 = datetime(2012, 3, 1, 0, 0, tzinfo=UTC)
HEADER = "start_utc,duration_s,dose_b_ugy_h,dose_e_ugy_h,qc,file\n"


def write(tmp_path: Path, rows: list[str]) -> Path:
    path = tmp_path / "rad.csv"
    path.write_text(HEADER + "".join(r + "\n" for r in rows), encoding="utf-8")
    return path


def test_partial_and_flagged_observations_are_left_out(tmp_path: Path) -> None:
    path = write(
        tmp_path,
        [
            "2012-03-01T01:00:00Z,928,16.5,19.0,00000000,A.TXT",
            "2012-03-01T00:00:00Z,930,16.0,18.0,00000000,A.TXT",
            "2012-03-01T02:00:00Z,120,0.2,0.2,00000000,A.TXT",
            "2012-03-01T03:00:00Z,928,99.0,99.0,00000001,A.TXT",
            "2012-03-01T04:00:00Z,464,18.5,18.5,00000000,A.TXT",
        ],
    )

    observations = load_rad_observations(path)

    assert [o.dose_e_ugy_h for o in observations] == [18.0, 19.0, 18.5]


def test_an_isolated_dip_is_left_out_but_a_real_rise_is_kept(tmp_path: Path) -> None:
    doses = [18.0, 19.0, 18.5, 3.0, 18.7, 19.1, 18.9, 40.0, 60.0, 80.0]
    path = write(
        tmp_path,
        [f"2012-03-01T{h:02d}:00:00Z,928,0,{d},00000000,A.TXT" for h, d in enumerate(doses)],
    )

    observations = load_rad_observations(path)

    assert [o.dose_e_ugy_h for o in observations] == [d for d in doses if d != 3.0]


def test_a_file_without_usable_observations_is_an_error(tmp_path: Path) -> None:
    path = write(tmp_path, ["2012-03-01T02:00:00Z,120,0.2,0.2,00000000,A.TXT"])

    with pytest.raises(RadDataError, match="no full observations"):
        load_rad_observations(path)


def test_the_background_and_a_storm_excess_get_their_own_quality_factor() -> None:
    conversion = DoseEquivalent(background_ugy_h=20.0, q_excess=1.0, q_background=3.82)

    # 20 µGy/h of cosmic rays for a day is 0.48 mGy, or 1.83 mSv with Q 3.82.
    assert conversion.msv_per_day(20.0) == pytest.approx(1.8336)
    # A storm adds 100 µGy/h of protons on top: 2.4 mGy more, with Q 1.
    assert conversion.msv_per_day(120.0) == pytest.approx(1.8336 + 2.4)
    assert conversion.background_msv_per_day == pytest.approx(1.8336)
    # Below the background, all of it counts as cosmic rays.
    assert conversion.msv_per_day(10.0) == pytest.approx(0.9168)


def replay() -> DoseReplay:
    observations = [
        RadObservation(T0, 20.0),
        RadObservation(T0 + timedelta(hours=2), 120.0),
    ]
    conversion = DoseEquivalent(background_ugy_h=20.0, q_excess=1.0, q_background=3.82)
    return DoseReplay(observations, T0, conversion)


def test_the_replay_holds_the_last_measurement_until_the_next_one() -> None:
    measured = replay()

    assert measured.absorbed_ugy_h(timedelta(hours=1, minutes=59)) == 20.0
    assert measured.absorbed_ugy_h(timedelta(hours=2)) == 120.0
    assert measured.absorbed_ugy_h(timedelta(days=3)) == 120.0


def test_a_replay_cannot_start_before_the_first_measurement() -> None:
    conversion = DoseEquivalent(background_ugy_h=20.0, q_excess=1.0)

    with pytest.raises(RadDataError, match="before the first observation"):
        DoseReplay([RadObservation(T0, 20.0)], T0 - timedelta(hours=1), conversion)


class FakeSource:
    def __init__(self) -> None:
        self.exams: list[Signal] = []

    def read(self, at: datetime) -> list[Reading]:
        return [
            Reading.create("dose_today", 1.8, at, "simulator"),
            Reading.create("heart_rate", 68, at, "simulator"),
        ]

    def request_exam(self, signal: Signal, at: datetime) -> None:
        self.exams.append(signal)


def test_only_the_dose_is_replaced_and_it_names_its_source() -> None:
    inner = FakeSource()
    source = ReplayedDose(inner, replay(), elapsed=lambda at: at - T0)

    dose, heart = source.read(T0 + timedelta(hours=3))

    assert (dose.value, dose.source) == (round(1.8336 + 2.4, 2), SOURCE)
    assert (heart.value, heart.source) == (68, "simulator")
    source.request_exam(Signal.GLUCOSE, T0)
    assert inner.exams == [Signal.GLUCOSE]


def test_calibration_on_the_nasa_file_matches_the_published_numbers() -> None:
    observations = load_rad_observations(RAD_DOSE_CSV)
    conversion = calibrate(observations)

    # Cosmic-ray background before the storm: 0.45 mGy per day, 1.7 mSv per day with Q 3.82.
    assert conversion.background_ugy_h == pytest.approx(18.61, abs=0.01)
    assert conversion.background_msv_per_day == pytest.approx(1.706, abs=0.005)
    # The storm's protons: a quality factor near 2 gives the published 19.5 mSv.
    assert conversion.q_excess == pytest.approx(1.99, abs=0.01)
    assert 1 <= conversion.q_excess < conversion.q_background
    # The storm crosses ten times the background on 8 March 2012 at 14:52 UTC.
    storm = [
        o.start
        for o in observations
        if conversion.msv_per_day(o.dose_e_ugy_h) >= 10 * conversion.background_msv_per_day
    ]
    assert storm[0] == datetime(2012, 3, 8, 14, 52, 14, tzinfo=UTC)
