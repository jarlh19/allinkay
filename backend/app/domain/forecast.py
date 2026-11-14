"""Short-horizon forecast with Holt's linear exponential smoothing (level and trend).

Light enough for the field device: a few multiplications per point, no training data.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

ALPHA = 0.5
BETA = 0.3
Z_80 = 1.2816
"""Two-sided 80% interval for the forecast margin."""


class ForecastError(ValueError):
    """Not enough history to forecast."""


@dataclass(frozen=True)
class ForecastPoint:
    step: int
    value: float
    low: float
    high: float


@dataclass(frozen=True)
class Forecast:
    history: tuple[float, ...]
    points: tuple[ForecastPoint, ...]
    trend_per_step: float


def holt_forecast(
    values: Sequence[float], horizon: int, alpha: float = ALPHA, beta: float = BETA
) -> Forecast:
    if len(values) < 3:
        raise ForecastError(f"at least 3 values are needed, got {len(values)}")
    if horizon < 1:
        raise ForecastError("horizon must be at least 1")
    level = values[0]
    trend = values[1] - values[0]
    errors: list[float] = []
    for value in values[1:]:
        predicted = level + trend
        errors.append(value - predicted)
        new_level = alpha * value + (1 - alpha) * (level + trend)
        trend = beta * (new_level - level) + (1 - beta) * trend
        level = new_level
    sigma = math.sqrt(sum(e * e for e in errors) / len(errors))
    points = tuple(
        ForecastPoint(
            step=h,
            value=level + h * trend,
            low=level + h * trend - Z_80 * sigma * math.sqrt(h),
            high=level + h * trend + Z_80 * sigma * math.sqrt(h),
        )
        for h in range(1, horizon + 1)
    )
    return Forecast(history=tuple(values), points=points, trend_per_step=trend)
