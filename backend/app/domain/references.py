"""Evidence behind each alert: the NASA and CSA sources cited in the problem statement."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.domain.readings import Signal


class Ref(StrEnum):
    SLEEP = "nasa-risk-sleep"
    BEHAVIORAL = "nasa-risk-behavioral"
    CARDIOVASCULAR = "nasa-risk-cardiovascular"
    IMMUNE = "nasa-risk-immune"
    HYPOXIA = "nasa-risk-hypoxia"
    RADIATION = "nasa-risk-radiation"
    HAZARDS = "nasa-hazards"
    RADIATION_STANDARD = "nasa-std-3001-radiation"


@dataclass(frozen=True)
class Reference:
    ref: Ref
    title: str
    url: str


REFERENCES: dict[Ref, Reference] = {
    r.ref: r
    for r in (
        Reference(
            Ref.SLEEP,
            "NASA: Risk from Inadequate Sleep and Irregular Schedules",
            "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/",
        ),
        Reference(
            Ref.BEHAVIORAL,
            "NASA: Risk of Behavioral Changes and Psychiatric Disorders",
            "https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/",
        ),
        Reference(
            Ref.CARDIOVASCULAR,
            "NASA: Risk of Cardiovascular Adaptations",
            "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/",
        ),
        Reference(
            Ref.IMMUNE,
            "NASA: Risk of Altered Immune System Responses",
            "https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/",
        ),
        Reference(
            Ref.HYPOXIA,
            "NASA: Risk of Hypoxia",
            "https://www.nasa.gov/reference/risk-of-hypoxia/",
        ),
        Reference(
            Ref.RADIATION,
            "NASA: Risk of Radiation-Induced Cancers",
            "https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/",
        ),
        Reference(
            Ref.HAZARDS,
            "NASA: 5 Hazards of Human Spaceflight",
            "https://www.nasa.gov/hrp/hazards/",
        ),
        Reference(
            Ref.RADIATION_STANDARD,
            "NASA-STD-3001 Technical Brief: Design for Ionizing Radiation Protection",
            "https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf",
        ),
    )
}

SIGNAL_EVIDENCE: dict[Signal, Ref] = {
    Signal.HEART_RATE: Ref.CARDIOVASCULAR,
    Signal.SYSTOLIC_BP: Ref.CARDIOVASCULAR,
    Signal.DIASTOLIC_BP: Ref.CARDIOVASCULAR,
    Signal.SPO2: Ref.HYPOXIA,
    Signal.SLEEP_HOURS: Ref.SLEEP,
    Signal.MOOD: Ref.BEHAVIORAL,
    Signal.REACTION_TIME: Ref.BEHAVIORAL,
    Signal.BODY_TEMPERATURE: Ref.IMMUNE,
    Signal.WHITE_BLOOD_CELLS: Ref.IMMUNE,
    Signal.GLUCOSE: Ref.HAZARDS,
    Signal.SYMPTOMS: Ref.IMMUNE,
    Signal.CABIN_TEMPERATURE: Ref.HAZARDS,
    Signal.CABIN_CO2: Ref.HAZARDS,
    Signal.CABIN_PRESSURE: Ref.HYPOXIA,
    Signal.CABIN_PPO2: Ref.HYPOXIA,
    Signal.DOSE_TODAY: Ref.RADIATION,
}
