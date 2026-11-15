# NASA PDS data: Curiosity's RAD on its way to Mars

The Radiation Assessment Detector (RAD) on the Mars Science Laboratory, Curiosity, measured the
radiation inside the spacecraft during its cruise to Mars. Its data is archived in NASA's
Planetary Data System (PDS), Planetary Plasma Interactions node:

- Data set `MSL-M-RAD-3-RDR-V1.0` (volume MSLRAD_1002), directory `DATA/CRUISE`:
  <https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/CRUISE/>
- Format: RAD RDR Software Interface Specification:
  <https://pds-ppi.igpp.ucla.edu/volume/MSLRAD_1002/DOCUMENT/RAD_RDR_SIS.HTM>

`MSL_RAD_cruise_dose_2012-02-28_2012-03-15.csv` keeps, for every observation from 28 February to
15 March 2012 (17 daily files, `RAD_RDR_2012_059` to `RAD_RDR_2012_075`), only:

| Column | Meaning |
|---|---|
| `start_utc` | Start of the observation (`START_OBS_UTC`) |
| `duration_s` | Its length in seconds, from the L1 counters |
| `dose_b_ugy_h` | Total dose rate in detector B (silicon), microgray per hour |
| `dose_e_ugy_h` | Total dose rate in detector E (plastic, close to tissue), microgray per hour |
| `qc` | The observation's quality flag |
| `file` | The RDR file it comes from |

The values are unchanged. `scripts/build_rad_dose.py` rebuilds the file from PDS (it streams
about 400 MB and keeps about 77 KB). Downloaded on 2026-11-15.

## How the app uses it

The demo's dose readings replay detector E from noon on 29 February 2012, so the solar storm of
7 March 2012 arrives on mission day 98 (script day 8). See `backend/app/adapters/rad_csv.py`.

- **Left out:** observations shorter than 5 minutes, any with a quality flag, and isolated dips
  below 85% of both the 3 observations before and the 3 after. That is one observation a day,
  always between 09:46 and 11:02 UTC, plus one on 28 February at 13:00: a pattern of the
  instrument's day, not of the radiation.
- **Absorbed dose to dose equivalent:**
  - The cosmic-ray background is the median before 7 March. It is converted with the mean
    quality factor that RAD measured in transit, 3.82 (Zeitlin et al., 2013).
  - The storm's excess above that background is mostly protons. Its quality factor is the one
    that turns the measured excess from 7 to 15 March into the 19.5 mSv published for that
    storm from the same instrument (Guo et al., 2015).
- **What RAD measured:** shielded inside the cruise stage, not a human body. The app uses it
  as the ship's dosimeter reading for every crew member.

## Citations

- Hassler, D. M., Zeitlin, C., et al. *MSL RAD Reduced Data Record* (MSL-M-RAD-3-RDR-V1.0)
  [Data set]. NASA Planetary Data System, PPI node.
- Zeitlin, C., et al. (2013). Measurements of energetic particle radiation in transit to Mars
  on the Mars Science Laboratory. *Science, 340*(6136), 1080–1084.
  <https://doi.org/10.1126/science.1235989>
- Guo, J., et al. (2015). Variations of dose rate observed by MSL/RAD in transit to Mars.
  *Astronomy & Astrophysics*. <https://arxiv.org/abs/1503.06631>
