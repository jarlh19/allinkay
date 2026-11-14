import pytest

from app.domain.forecast import ForecastError, holt_forecast


def test_a_steady_decline_is_extended_with_a_tight_margin() -> None:
    forecast = holt_forecast([7.4, 7.0, 6.6, 6.2, 5.8], horizon=3)

    assert forecast.trend_per_step == pytest.approx(-0.4, abs=0.01)
    assert [round(p.value, 2) for p in forecast.points] == [5.4, 5.0, 4.6]
    assert all(p.high - p.low < 0.05 for p in forecast.points)


def test_known_series_against_hand_calculation() -> None:
    # level0=10, trend0=2; then 12 -> L=12, T=2; 15 -> L=14.5, T=2.15
    forecast = holt_forecast([10, 12, 15], horizon=2, alpha=0.5, beta=0.3)

    assert forecast.trend_per_step == pytest.approx(2.15)
    assert forecast.points[0].value == pytest.approx(16.65)
    assert forecast.points[1].value == pytest.approx(18.8)


def test_the_margin_widens_with_the_horizon() -> None:
    forecast = holt_forecast([7.2, 7.6, 6.9, 7.4, 6.8, 7.1], horizon=3)

    widths = [p.high - p.low for p in forecast.points]
    assert widths[0] < widths[1] < widths[2]


def test_forecast_needs_three_values_and_a_horizon() -> None:
    with pytest.raises(ForecastError, match="at least 3"):
        holt_forecast([7.0, 6.5], horizon=3)
    with pytest.raises(ForecastError, match="horizon"):
        holt_forecast([7.0, 6.5, 6.0], horizon=0)
