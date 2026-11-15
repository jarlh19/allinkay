# Decisions

Each entry gives the problem, what was chosen, the alternatives that were set aside and why. Decided by Jorge Laban for team ALLINKAY during NASA Space Apps 2026 (14 and 15 November 2026).

## D-001 · Modular monolith with a hexagonal architecture

- **Problem:** the app receives data from several sources (field sensors, ship sensors, blood tests, a dosimeter and feedback from Earth) and must work on board without the internet.
- **Chosen:** a single deployment with a pure domain core and one adapter per data source (ports and adapters), joined by an in-process event bus.
- **Set aside:** microservices, one per component.
- **Why:** receiving data from several sources is an integration problem, not a deployment one. In a two-day hackathon with one developer, microservices add processes, networking, contracts and points of failure to the demo. With modules separated by ports, they can still be split later if needed.

## D-002 · Python with FastAPI for the backend, React with Vite and TypeScript for the frontend

- **Problem:** the model (deviations, combined patterns and forecast) is the core of the project, and the interface weighs in the judging.
- **Chosen:** FastAPI with NumPy for the backend; React 19, Vite and strict TypeScript for the frontend.
- **Set aside:** everything in TypeScript, since numerical work is more limited there; and Python with Streamlit, which gives less control over the panel design.
- **Why:** Python has the best tools for the model, and React reproduces the panel mock-up the team approved.
- **Update:** scikit-learn and ECharts were planned but not needed. The model turned out to be statistical (D-011), and the charts are plain SVG.

## D-003 · Private repository until submission

- **Problem:** NASA requires a public link to the project at submission, but during development the repository can expose half-finished work.
- **Chosen:** private during the event, public before submission on Sunday 15 November.
- **Set aside:** public from the first commit, and a team organisation.
- **Why:** it protects the work while it is being built and does not depend on creating an organisation in the middle of the event.

## D-004 · Mars as the mission scenario

- **Problem:** delay and radiation figures change a lot between the Moon and Mars.
- **Chosen:** Mars, with these figures:
  - a delay of 0 to 22 minutes one way (McBrayer et al., 2022);
  - 1.8 mSv per day in transit (Zeitlin et al., 2013);
  - a career limit of 600 mSv (NASA-STD-3001).
- **Set aside:** the Moon, with a delay of 1.3 seconds.
- **Why:** on Mars, autonomy on board is essential, and that is what the team's problem statement is about.

## D-005 · Synthetic data; real sensors stay out of this version

- **Problem:** at the start it was not known which sensors the team had or how they would connect.
- **Chosen:** a seeded simulator calibrated with reference levels. The only real data is NASA's open blood count (OSD-569), used as a baseline. The sensor adapter interface is ready.
- **Set aside:** waiting for the sensors to start.
- **Why:** the team confirmed it could work with synthetic data, the demo does not depend on hardware, and no real people's data is handled.

## D-006 · Testers act as outside users and report from inside the app

- **Problem:** two teammates review the app and ask for fixes, but they test it as astronauts would, not as developers.
- **Chosen:** they use the app as end users and report with a "Report a problem" form inside it. Each report carries its context (screen, crew member, mode, mission day and time).
- **Set aside:** reporting through chat messages without context.
- **Why:** they test like the end user, and every report arrives with what is needed to reproduce it.
- **Update (D-009 and 14 November):**
  - The testers use the published URL instead of a laptop, and reports become GitHub issues.
  - Later the same day, both testers also joined the repository as collaborators to help with development.

## D-007 · Apache 2.0 licence

- **Problem:** a previous hackathon project was left without a licence, and doubts about patents came up later.
- **Chosen:** Apache 2.0, with a NOTICE file that gives credit and cites the NASA data.
- **Set aside:** MIT, and no licence.
- **Why:** it is as open as MIT and also includes an explicit patent grant, which avoids patent disputes.

## D-008 · Language

- **Problem:** NASA Space Apps requires English on the project page and in everything linked from it, but the testers test in Spanish.
- **Chosen:**
  - Code, identifiers, commits and documentation are in English.
  - The interface opens in the browser's language and can switch between English and Spanish.
  - The page asks browsers not to machine-translate it, since it has its own translation.
- **Set aside:** everything in Spanish, and translating the interface only at the end.
- **Why:** it meets the rule without leaving the testers without an interface in their language. Machine translation garbled terms ("live" became "to live").

## D-009 · Publishing the app on Render as a single service

- **Problem:** the testers use the app from their own browsers, not on the developer's laptop.
- **Chosen:** one web service on Render (free plan) built from one Docker image, where the same FastAPI serves the built frontend. It deploys itself on every change to `main`.
- **Set aside:**
  - Hugging Face Spaces: the Space's code would be public too early.
  - Frontend and backend as separate services: two deployments and CORS.
  - Vercel (reviewed on 14 November): its functions keep no shared state between instances and do not run a continuous process. ALLINKAY keeps each mission in memory and advances it every second, so moving would mean rebuilding the core.
  - Only on the laptop: the testers could not use it from their browsers.
- **Why:** it costs nothing and supports WebSockets. A single service keeps the demo and the security simple: same origin, no CORS.
- **Limits of the free plan:**
  - It sleeps after 15 minutes without traffic, and the first visit then takes 30 to 60 seconds.
  - The disk is not persistent: stored data is lost on restart. For that reason tester reports go to GitHub issues and do not rely on SQLite alone.

## D-010 · Several crew members, one mission per person

- **Problem:** with a single crew member, whoever was in the ship and whoever went out to the field shared the same normal, alerts and mode. Also, anyone opening the web changed the mode for everyone.
- **Chosen:**
  - A crew registry (`Crew`). Each person has their own mission: their readings, normal, model (ship or field), accumulated dose and live channel.
  - Routes carry the person's id: `/api/crew/{id}/…` and `/ws/crew/{id}/live`. Also, `/api/crew` gives a summary of everyone.
  - The readings table gains a `crew` column as an additive change; earlier rows belong to the commander.
  - In the demo, every lap of the script repeats the first one exactly, including the dose, so what testers see is what the tests checked.
  - The demo clock moves exactly one step per tick, independent of the server's real time. Without this, a few milliseconds of delay shifted the simulated sequence and noise alerts appeared that the tests did not see.
- **Set aside:**
  - A single channel with events tagged by person: every browser would receive everyone's readings, three times the data over a slow connection.
  - Several processes, one per person: it complicates Render (D-009) with no gain for the demo.
- **Why:** each person is judged against their own normal, which is the core idea of the project. Changing one person's mode does not affect the others, and the browser only receives the person being watched.

## D-011 · Confirmed alerts: how many false alarms and how many missed changes

- **Problem:** a measurement on 14 November showed that, in the ship, 40 of 40 healthy synthetic people had at least one false alarm within 30 days. They came from lab exams and daily signals, for three reasons:
  - A single exam out of range was enough to alert, and the simulator used less variation than real life.
  - The normal came from 14 days and 3 blood draws but was used as if it were exact.
  - Mood, a 1 to 5 scale, was treated as a continuous measure.
- **What is not possible:** with finite data, zero false alarms and zero missed changes cannot both hold. Lowering one raises the other, and only more information lowers both. This was measured with 200,000 simulated people.
- **Chosen by Jorge:**
  - First, he asked to prioritise not missing real changes.
  - Then, with the numbers measured in the app itself, he chose the 99.5% threshold for lab exams. It gives half the false alarms of the 99% threshold, at the cost of 1 more white blood cell drop in 200 taking longer than 10 days to detect.
  - The targets are:
    - At most 1 false alarm every 10 astronaut-years.
    - At most 1% of scripted changes undetected in the first 10 days. A change that persists is caught by the following readings.
- **How:**
  - **Lab exams:**
    - The set point is the mean of 6 pre-flight draws.
    - The spread is the published within-subject biological variation plus the analytical variation. Both come from the EFLM Biological Variation Database: leukocytes CVI 11.1%, glucose CVI 4.9%, with CVA = CVI / 2 (Fraser, 2001).
    - A result beyond the 99.5% reference change value (2.81) asks for a repeat the next day. It alerts only if the repeat agrees, and never on a single result.
    - The commander uses the 3 real OSD-569 draws.
  - **Personal normal:**
    - Judged with a prediction interval that combines Student's t with the factor 1 + 1/n.
    - The reference covers 60 days before flight.
    - With fewer than 5 readings there is no alert.
  - **Daily signals:** they alert when 3 of the last 4 days go beyond 2.2. One ordinary day inside a real change no longer resets the count.
  - **Live signals:** the rule of 10 readings in a row beyond 1.5 stays; it already gave zero false alarms.
  - **Mood:** the usual value is the median, and whole steps count. It alerts when mood is 2 steps below on 3 of the last 4 days.
  - **Simulator and script:**
    - Lab exams vary as the EFLM data says.
    - The commander's scripted changes are clinically significant: white blood cells −3.5 and mood −2.2.
    - The demo takes exams every 2 days.
- **Set aside:**
  - Only raising thresholds: fewer false alarms, but real changes slipped through (12 of 60 for reaction time).
  - CUSUM: it did not correct a badly estimated normal.
  - Requiring consecutive days: a single normal day broke a real change.
  - Two repeats, or averaging an exam with its repeat: the error that all draws share is the error of the normal, and repeating does not remove it.
- **Verification:**
  - `backend/validate_model.py` simulates 200 healthy people over 90 days, in the ship and in the field, plus 200 people for each crew script.
  - It measures false alarms per astronaut-year (ship and field separately) and missed changes, and fails if a target is not met.
  - A smaller sample runs on every change in `tests/validation`.
- **Measured result** (200 people over 90 days):
  - Ship: 6 false alarms in 60 astronaut-years, one every 10 years. Four come from lab exams and two from daily signals.
  - Field: 0.
  - Scripted changes missed within 10 days: 5 of 1200 (0.42%). Three are white blood cell drops.
  - With the 99% threshold there were 11 false alarms in the ship and 4 missed changes.
  - With 200 people, small counts carry a wide margin of error.
- **Limit:** the numbers come from synthetic people with normal noise. Real data has outliers and trends this test does not cover, so the model must be validated on real data before it is used with people.

## D-012 · The radiation career limit is an emergency, with no invented threshold

- **Problem:** crossing the 600 mSv career limit raised no alert, and the radiation section still said "Within limit".
- **Chosen:** reaching the limit raises an emergency that cites the standard. The action asks to tell the flight surgeon and to keep any further dose as low as reasonably achievable.
  - The limit is NASA-STD-3001 [V1 4030]: a crew member's career effective dose "shall be less than 600 mSv".
  - The guiding principle is ALARA ("as low as reasonably achievable", [V1 4029]).
- **Set aside:** an "approaching the limit" alert at, for example, 90%. The standard gives no such threshold, and the panel already projects the days left at the current rate.
- **Why:** a broken requirement deserves the emergency path, and every number in an alert should come from a source.

## D-013 · The 3D body is a hologram of a real anatomy atlas

- **Problem:** the team's reference for the central figure is a see-through "medical hologram" with the skeleton and organs inside. The first 3D body was a smooth mannequin with coloured blocks on it: it read as clothing, not as health.
- **Chosen:**
  - One model for the skin, skeleton, brain, heart and airways, all from the same body in the BodyParts3D atlas (CC BY 4.0, see NOTICE). Every part sits exactly inside the skin, and the pose (arms at the sides) is the one of the reference.
  - A hologram look: cyan, see-through faces, a bright outline, scan lines, a rising sweep, a glow (bloom) and a lit pedestal.
  - Status colour only where there is an alert: a zone, the brain or the heart turns amber or red; the outline of the skin shows radiation, and the pedestal shows the environment.
  - The healthy heart stays pale, not red, because red means critical everywhere else on the panel.
  - Body zones come from the nearest bone, baked into the model, so clicks and colours follow the real arms and legs.
  - `scripts/build_anatomy.py` rebuilds the model from the official download.
- **Set aside:**
  - Keeping the mannequin and drawing organs as spheres: it stayed far from the reference.
  - Anatomy models from 3D marketplaces: most are paid or have no open licence.
  - Fitting an atlas skeleton inside the old mannequin: its arms were in a different pose.
  - Unity: a second engine a day before the deadline. It remains an idea for a later VR or AR version.
- **Cost:** the model is about 2 MB, loaded only when the 3D body is shown. Devices without WebGL keep the 2D figure.

## D-014 · A mission view with the team's "Mission Health" layout, and only real values

- **Problem:** the team's "Mission Health" design shows indicators the app does not measure (mental health, bone health, muscle mass, an "integral health" score, a 7-day trend for every signal) and an AI analysis text, with a photo of a person and a painted background.
- **Chosen:** a second view inside the app (`#mission`), fed by the same live data as the panel.
  - The six bubbles are the panel's six systems, with real values. The cardiovascular one shows the latest heart rate in beats per minute.
  - "Estado general" is the share of signals inside the person's normal, as on the panel.
  - The trend card shows only the series the app keeps: the last heart rate readings and the last nights of sleep. Its labels say how many values each has.
  - The analysis is the model's own reading of confirmed changes, under its real name.
  - The body is the 3D hologram (D-013), and the crew member is shown by the initial of their role.
  - Selecting a bubble or a part of the body keeps the view and shows that system's detail beside the hologram, the same detail as the panel's section. A link opens it in the full panel.
- **Set aside:**
  - Inventing values or formulas for what is not measured.
  - Using the design's photo and background: their origin is unknown, and the repository will be public.
  - Replacing the panel: the detail of each system lives there.

## D-015 · One screen: the mission view replaces the panel

- **Problem:** two views showed the same live data. Once the mission view could show a system's detail beside the hologram, the panel only added the same detail laid out differently, and a judge or tester could land on either.
- **Chosen:** the mission view (D-014) is the app's only screen, at the main address.
  - Moved into it from the panel:
    - the ship / field switch and the legend, under the hologram;
    - "Report a problem" and the "Earth link: up to 22 min delay" label, in the header;
    - the actions (action guide and mitigation routine), in their own card.
  - Emergency and connection notices stay at the top.
  - A system's detail opens beside the hologram when its bubble or its part of the body is selected; it is the same detail the panel's section had.
  - The side column is 400 px wide, so the model's detail fits.
- **Set aside:** keeping both views. Both would need maintaining and testing, and the video, the judges and the testers should all see the same screen.
- **Trade-off:** the panel opened by itself every section with an alert. Here the alerting bubbles and the model's analysis show what needs attention, emergencies show at the top, and the detail opens on demand.

## D-016 · In the field the hologram wears NASA's spacesuit

- **Problem:** the ship and field modes looked the same on the hologram, although in the field the crew member works inside a spacesuit, and the suit is what stands between the body and the radiation.
- **Chosen:** in the field, the outline of the hologram is NASA's 3D model of the Extravehicular Mobility Unit (NASA 3D Resources, credit NASA/Michael D. Carbajal).
  - The suit takes the place of the skin, with the same body zones, so a click and the alert colours work as before; the outline still shows radiation.
  - The brain, heart and airways stay visible inside it. The skeleton is hidden, because its straight arms would show outside the suit's bent sleeves.
  - The suit glows at 40 % of the skin's strength: its layers add up to a glare at full strength.
  - It loads the first time the field mode is shown (about 0.7 MB), so the first screen loads as fast as before.
- **Set aside:**
  - The suit as a translucent shell over the skin: the suit's arms are bent outwards and the body's hang straight, so the two never line up.
  - The Advanced Crew Escape Suit from the same collection: it is worn for launch and landing, not for work outside.
- **Trade-off:** the EMU is the suit used for spacewalks from the International Space Station, not a Mars surface suit; it is the closest suit NASA publishes as a 3D model.

## D-017 · Two more open NASA sources: the commander's glucose and the storm's real reference event

- **Problem:** the judging asks for NASA data at the centre of the project. Apart from the white blood cells (OSD-569), the commander's lab normals and the solar storm were synthetic, and the storm had no link to anything that really happened.
- **Chosen:**
  - **Glucose from OSD-575.** The commander's glucose normal is the mean of the same three pre-flight draws of Inspiration4 crew member C001 (83, 80 and 69 mg/dL), with the published variation as its spread, exactly as for white blood cells. The simulator centres glucose on that mean (77.33 mg/dL instead of 92), as it already did for white blood cells. The screen names the study behind each normal.
  - **The storm's reference event from NASA DONKI.** The demo storm names the real event it refers to: the X5.4 flare of 7 March 2012 and the protons above 100 MeV that reached GOES-13 3.7 hours later (`2012-03-07T04:05:00-SEP-001`). Curiosity's RAD recorded 19.5 mSv over that storm on its way to Mars (Guo et al., 2015). The screen says that the size of the demo storm is synthetic.
  - Both sources are files in the repository (`data/osdr`, `data/donki`), read from disk, so the app needs no internet on board.
  - Measured again with `validate_model.py` after the change: in the ship 5 false alarms in 60 astronaut-years (it was 6), in the field 0, and 5 of 1200 scripted changes missed. The targets of D-011 are still met.
- **Set aside:**
  - The dose that RAD measured hour by hour during the cruise (NASA PDS): about 230 MB for the 10 days of that storm and a reader for its format. It is the next step to replace the synthetic dose.
  - Calling DONKI live: the app must work without a connection, and the demo key of api.nasa.gov runs out quickly on a shared network.
  - Glucose after the flight: at R+45, three of the four crew members are below the lab's range (36 to 44 mg/dL) for a reason the data does not explain.
  - In-flight vital signs (heart rate, sleep, cognition): NASA keeps them restricted (LSDA, TRISH EXPAND), so they cannot be used here.

## D-018 · The field suit is the Z2, NASA's prototype for planetary surfaces

- **Problem:** D-016 dressed the field mode in the Extravehicular Mobility Unit, the suit for spacewalks from the International Space Station. ALLINKAY's field is the surface of Mars.
- **Chosen:** NASA's 3D model of the Z2 Spacesuit (NASA 3D Resources, credit NASA/LaRC/Advanced Concepts Lab), NASA's prototype suit for planetary surfaces such as Mars. It replaces the EMU in `suit.glb`; everything else in D-016 holds.
  - It already faces the body's way and needs no copies removed; `scripts/build_suit.py` keeps a `--turn` option for other models.
  - Its legs and helmet line up with the body; its arms reach forward, which is fine because the skin and skeleton are hidden in the field.
- **Set aside:** keeping the EMU (a spacewalk suit, not a surface suit).

## D-019 · The synthetic cabin is centred on the real ISS cabin

- **Problem:** the cabin temperature (22 °C) and CO2 (3.0 mmHg) of the simulator were plausible guesses without a source, while NASA publishes what the International Space Station's cabin really measured.
- **Chosen:**
  - The level and spread of the synthetic cabin come from the Environmental Data App (EDA) of NASA OSDR, which publishes the ISS cabin readings of each Rodent Research mission. The simulator uses the median of the mission medians and the median of the mission spreads (interquartile range / 1.349, which ignores sensor drop-outs), so every mission counts once however long it was.
  - Cabin temperature: 22.55 °C with a spread of 0.5 °C (14 missions, 2014 to 2024; it was 22 °C and 0.5).
  - Cabin CO2: 2913 ppm, 2.2 mmHg at the simulator's 101.3 kPa, with a spread of 0.3 mmHg (10 missions, 2014 to 2021; it was 3.0 mmHg and 0.3).
  - The summary by mission is a small CSV in `data/eda`, rebuilt by `scripts/eda_cabin_summary.py` from the EDA API, and a test keeps the simulator in step with it. The readings in the app are still synthetic; only their level and spread are real.
  - Measured again with `validate_model.py` after the change: in the ship 5 false alarms in 60 astronaut-years, in the field 0 in 55, and 5 of 1200 scripted changes missed, the same as before; none of the false alarms comes from the cabin. The targets of D-011 are still met.
- **Set aside:**
  - Reading the EDA from the app: the app must work without a connection, and the EDA only has past missions in low Earth orbit.
  - The public live telemetry of the ISS (Lightstreamer feed `ISSLIVE`): it also gives the cabin pressure and oxygen, but only the latest value, without history, and on 15 November 2026 its oxygen and CO2 had not been updated since 2 and 3 November. The pressure (101.3 kPa) and oxygen (21.2 kPa) keep their reference levels.
  - The EDA's daily dose: it is measured in low Earth orbit, in mGy per day, not on the way to Mars, so the cruise rate measured by Curiosity stays (Zeitlin et al., 2013).
  - Sleep: by actigraphy the ISS crews slept 6.09 ± 0.67 h per night (Barger et al., 2014, *Lancet Neurology* 13(9), 904–912), and the simulator uses 7.4 h. Changing it moves the values of the demo story, so it is left for its own decision.
- **Trade-off:** RR-10 and RR-23 overlap in December 2020 and January 2021, so those weeks count twice. The mission CO2 medians range from 2141 to 3638 ppm (the four missions from 2019 on are all below 2700 ppm, and five of the six before are above 3100), so the median is sensitive: leaving RR-10 out would give 22.6 °C and 2.4 mmHg. The alerts compare each reading with the person's own baseline, so the level itself does not decide when they fire.

## D-020 · The demo's dose is what Curiosity's RAD measured on its way to Mars

- **Problem:** the dose was synthetic: a fixed 1.8 mSv per day and a made-up 6-hour storm. The storm already named a real event (D-017), but its size and timing were invented.
- **Chosen:** the demo replays the dose that Curiosity's Radiation Assessment Detector (RAD) measured inside the spacecraft in cruise, from NASA's Planetary Data System (`MSL-M-RAD-3-RDR-V1.0`).
  - **Window:** from noon on 29 February to 10 March 2012, one 10-day lap of the demo. The storm of 7 March climbs through script day 7 and, on day 8, its second wave crosses ten times the background and raises the storm emergency at 14:52 UTC on 8 March, as RAD saw it. After the storm, the cosmic rays drop below their usual level (a Forbush decrease), as measured.
  - **Data kept:** only the start, length and total dose of each observation, from 17 daily files (`data/rad`, 77 KB). `scripts/build_rad_dose.py` rebuilds it from PDS.
  - **Left out:** isolated dips below 85% of both neighbouring sides. In this file that is one observation a day, always between 09:46 and 11:02 UTC.
  - **Dose equivalent:** RAD gives absorbed dose in its plastic detector, close to tissue.
    - The cosmic-ray background (the median before 7 March, 18.6 µGy/h) uses RAD's measured quality factor of 3.82 (Zeitlin et al., 2013), giving 1.71 mSv per day.
    - The storm's excess, mostly protons, uses a factor of 1.99. That factor turns the measured excess from 7 to 15 March into the 19.5 mSv published for that storm (Guo et al., 2015).
  - **Everyone gets the ship's reading.** The engineer's extra storm dose for working outside was synthetic and is gone.
  - **The usual rate** for the storm rule is the measured background, not 1.8.
- **Effect on the demo:** the dose rises above everyone's normal on day 7, a day before the storm emergency. That is a new, real early warning. The storm emergency moves from day 8.0 to day 8.12.
- **Set aside:**
  - Computing the quality factor from RAD's LET spectra: more faithful, but it needs the full LET binning and a Q(L) function, and the result would still have to match the published total.
  - Scaling the storm for the engineer outside: no measured basis.
  - Replaying the whole 253-day cruise: about 5.7 GB of downloads for a 10-day demo lap.
- **Limits:** RAD sat inside the cruise stage, not in a human body or a crewed ship, and its storm factor is fitted to a single published total.

## D-021 · Cognitive tests open from the overall status, as tests in development

- **Problem:** the team's biomedical engineer is building tests of reaction time, memory, patterns and spatial orientation, as Python prototypes. The screen had no place for them, and the reaction time the model watches is still synthetic.
- **Chosen:** a "Cognitive tests" button under the overall status opens a window with the four tests.
  - Each test says what it measures and which test of NASA's Cognition battery it resembles: the Psychomotor Vigilance Test; the Visual Object Learning Test and Fractal 2-Back; the Matrix Reasoning Test; and the Line Orientation Test (Basner et al., 2015, *Aerospace Medicine and Human Performance* 86, 942–952).
  - All four are labelled "In development" until her prototypes are ported to the browser. Python does not run in the app, whose security policy only allows its own scripts.
  - When a test runs, its results will stay on the device. Feeding them to the model needs a new endpoint and the handling of personal data, so it stays out of the hackathon.
- **Set aside:** linking to the Python prototypes. They run on a computer, not in a browser, and nothing outside the app may run inside it.

## D-022 · The cognitive tests are playable in the app (ALLINKAY MIND)

- **Problem:** D-021 listed the four cognitive tests as in development. The team's biomedical engineer then delivered them as ALLINKAY MIND: a Python (Pygame) app and a standalone web page with its own layout.
- **Chosen:** her browser engine is ported to TypeScript and runs inside the same window as before. The trial counts, adaptive rules and metrics are hers; the styles are the app's, and the text is in English and Spanish.
  - **Reaction Alert:** 10 valid trials; it records the median response and the false starts.
  - **Memory Matrix:** 9 rounds of an adaptive sequence of 3 to 9 tiles.
  - **Pattern Solver:** 10 questions from 11 rule families, across three levels.
  - **Spatial Navigator:** 16 trials, alternating between recognising a transformation and following a route, across four levels.
  - Results stay in the browser, per crew member, in her session format (`module: allinkay_mind`), so her Python tools can still read them.
  - Each result is compared with the median of at least three earlier sessions of the same person, and a result 20% worse asks for a repeat. That threshold is her software heuristic, not a clinical cutoff, and the screen says so.
- **Set aside:**
  - Opening her standalone page, because its own layout and crew field broke the app's look.
  - The Pygame app, because it does not run in a browser.
- **Trade-off:** the results do not reach the model's neurological system yet. That needs an endpoint and the handling of personal data (D-021).

## D-023 · ALLINKAY MIND 3.0: speed and accuracy read together

- **Problem:** her version 3.0 of ALLINKAY MIND changed how a result is judged. One number against a single baseline could call a faster but sloppier session an improvement.
- **Chosen:** her 3.0 rules are ported, and the app sessions are marked 3.0.0.
  - Every trial is kept with its time, level and outcome. In Memory Matrix the clock starts when the sequence ends.
  - A session is compared only within the same task type and difficulty (the same sequence length or level, and for Spatial Navigator the same subtask), and only when three earlier sessions exist at that level.
  - Speed uses correct answers only, so fast guessing never looks better; the times of wrong answers stay stored and visible. Accuracy is compared on its own, and a false start counts as an error.
  - The two are then read together: "faster, but more errors" is never an improvement. A reading of slower, more errors or an accuracy drop asks for a repeat. The thresholds (20% in speed, 20 points in accuracy) are her exploratory software rules, not clinical cutoffs.
- **Fixed in the port:** her browser report's trend chart filtered on an undefined variable (`value` instead of `x.value`) and failed once a baseline existed. The app draws that trend correctly.

