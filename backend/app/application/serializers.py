"""Plain-dict views of domain objects for the API and the event bus."""

from __future__ import annotations

from typing import Any

from app.domain.readings import Reading


def reading_to_dict(reading: Reading) -> dict[str, Any]:
    spec = reading.spec
    return {
        "signal": reading.signal.value,
        "value": reading.value,
        "unit": spec.unit,
        "system": spec.system.value,
        "frequency": spec.frequency.value,
        "taken_at": reading.taken_at.isoformat(),
        "source": reading.source,
    }
