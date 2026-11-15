# NASA DONKI data

DONKI (Space Weather Database Of Notifications, Knowledge, Information) is NASA's catalogue of
space weather events, run by the Community Coordinated Modeling Center (CCMC) at Goddard Space
Flight Center (https://ccmc.gsfc.nasa.gov/tools/DONKI/). Both files are its answers, unchanged,
downloaded on 2026-11-15. The app reads them from disk, so it works without the internet.

| File | Request |
|---|---|
| `DONKI_SEP_2012-03-01_2012-04-29.json` | Solar energetic particle events: `https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2012-03-01&endDate=2012-04-29` |
| `DONKI_FLR_2012-03-07.json` | Solar flares: `https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=2012-03-07&endDate=2012-03-07` |

ALLINKAY uses event `2012-03-07T04:05:00-SEP-001` as the reference for the demo storm:

- an X5.4 flare peaked at 00:24 UTC on 7 March 2012 (GOES-15 X-ray sensor);
- protons above 100 MeV reached GOES-13 at 04:05 UTC, 3.7 hours later;
- DONKI sent its alert at 04:42 UTC.

Curiosity's RAD instrument, inside the spacecraft on its way to Mars, recorded 19.5 mSv over
this storm, from 7 to 15 March 2012 (Guo et al., 2015, https://arxiv.org/abs/1503.06631).
The demo's dose replays what RAD measured during this storm (see data/rad, D-020).

CCMC describes DONKI data as research quality, provided as is. NOAA's Space Weather Prediction
Center is the official source of space weather forecasts.

Acknowledgement: we acknowledge the Community Coordinated Modeling Center (CCMC) at Goddard
Space Flight Center for the use of DONKI, https://ccmc.gsfc.nasa.gov/tools/DONKI/.
