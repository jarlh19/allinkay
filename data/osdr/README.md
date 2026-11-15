# NASA OSDR data

Lab results of the SpaceX Inspiration4 crew, released through the NASA Open Science Data
Repository (OSDR). Crew members are anonymized (C001 to C004). Time points are days before
launch (L-) and after return (R+). Both files are unchanged except for their names.

| File | Study | Original file | Downloaded |
|---|---|---|---|
| `OSD-569_LSDS-7_complete_blood_count.csv` | OSD-569, *Whole Blood Measurements from the SpaceX Inspiration4 Mission* (https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) | `LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv` | 2026-11-14 |
| `OSD-575_LSDS-8_comprehensive_metabolic_panel.csv` | OSD-575, *SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays* (https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) | `LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv` | 2026-11-15 |

ALLINKAY uses the three pre-flight draws of crew member C001 (L-92, L-44 and L-3) as a real
personal baseline: white blood cells from OSD-569 (5.4, 5.5 and 7.0 thousand/µL) and glucose
from OSD-575 (83, 80 and 69 mg/dL). All other values in the app are synthetic.

Note on OSD-575: at R+45, three of the four crew members have glucose between 36 and 44 mg/dL,
below the lab's range of 65 to 99. The app does not use any time point after the flight.

Citations:

- NASA Open Science Data Repository. (2024). *Whole blood measurements from the SpaceX
  Inspiration4 mission (RNA-seq, epitranscriptome, WGS, clonal hematopoiesis, CBC)* (OSD-569)
  [Data set]. https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
- NASA Open Science Data Repository. (2024). *SpaceX Inspiration4 blood serum metabolic panel
  and immune/cardiac cytokine arrays (comprehensive metabolic panel and multiplex)* (OSD-575)
  [Data set]. https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
