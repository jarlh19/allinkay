# NASA OSDR Environmental Data App: ISS cabin

`iss_cabin_by_mission.csv` summarises the cabin temperature and CO2 that the International
Space Station recorded during NASA's Rodent Research missions, as published by the
Environmental Data App (EDA) of the NASA Open Science Data Repository. Each row is one
mission and one reading:

| Column | Meaning |
|---|---|
| `mission` | Rodent Research mission (RR-1 to RR-28) |
| `reading` | `temperature` (degrees C) or `co2` (ppm), measured aboard the ISS |
| `samples`, `first_utc`, `last_utc` | Readings used and the time they span |
| `median` | Median of the mission's readings |
| `iqr_sd` | Interquartile range divided by 1.349: the spread of a normal curve, without the sensor drop-outs (CO2 values of 128 to 500 ppm) and saturated readings (9000 ppm) that some missions contain |

The EDA API answered on 2026-11-15 with the cabin temperature of 14 Rodent Research missions
(2014 to 2024) and the CO2 of 10 of them (2014 to 2021). RR-4, RR-8, RR-17 and RR-22 came back
empty, and RR-18, RR-20, RR-25 and RR-28 have no CO2. RR-10 and RR-23 overlap in December 2020
and January 2021, so those weeks of the same cabin count twice; without RR-10 the medians would
be 22.6 °C and 2.4 mmHg. To rebuild the file:

```bash
python scripts/eda_cabin_summary.py
```

## How the app uses it

The simulator centres the synthetic cabin on the median of the mission medians and uses the
median of the mission spreads, so every mission counts once however long it was
(`backend/app/adapters/simulator.py`; a test keeps the two in step):

| Reading | Median mission | Spread | In the simulator |
|---|---|---|---|
| Cabin temperature | 22.55 °C | 0.52 °C | 22.55 °C, 0.5 °C |
| Cabin CO2 | 2913 ppm | 388 ppm | 2.2 mmHg, 0.3 mmHg (ppm × 760 mmHg / 10⁶, at the simulator's 101.3 kPa) |

The readings in the app are still synthetic: only their level and spread come from the ISS.
The cabin pressure and oxygen are not in the EDA and keep their reference levels.

## Source

- EDA: https://visualization.osdr.nasa.gov/eda/ (API: https://visualization.osdr.nasa.gov/eda/api/missions/)
- Units as labelled by the EDA's charts: temperature in degrees C, CO2 in ppm.

Citation: NASA Open Science Data Repository. (n.d.). *Environmental Data App (EDA)* [Data
set]. Retrieved November 15, 2026, from https://visualization.osdr.nasa.gov/eda/
