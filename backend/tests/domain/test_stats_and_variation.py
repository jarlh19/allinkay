import math

import pytest

from app.domain.readings import Signal
from app.domain.stats import normal_cdf, student_t_quantile
from app.domain.variation import LAB_VARIATION


@pytest.mark.parametrize(
    ("p", "df", "table"),
    [
        (0.975, 5, 2.571),
        (0.975, 13, 2.160),
        (0.975, 30, 2.042),
        (0.99, 13, 2.650),
        (0.995, 59, 2.662),
        (0.9772, 59, 2.040),
    ],
)
def test_student_t_quantile_matches_published_tables(p: float, df: int, table: float) -> None:
    assert student_t_quantile(p, df) == pytest.approx(table, abs=0.01)


def test_student_t_needs_valid_inputs() -> None:
    with pytest.raises(ValueError):
        student_t_quantile(0.975, 0)
    with pytest.raises(ValueError):
        student_t_quantile(1.0, 10)


def test_normal_cdf_at_two_standard_deviations() -> None:
    assert normal_cdf(2.0) == pytest.approx(0.97725, abs=1e-5)


def test_lab_variation_combines_biological_and_analytical_variation() -> None:
    wbc = LAB_VARIATION[Signal.WHITE_BLOOD_CELLS]

    assert wbc.cva == pytest.approx(0.0555)
    assert wbc.total_cv == pytest.approx(math.sqrt(0.111**2 + 0.0555**2))
