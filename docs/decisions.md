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
