# Spec: ALLINKAY, onboard health monitoring

> Living document. It records what ALLINKAY does, how it is built and checked, and what is left out. Decisions are in [docs/decisions.md](docs/decisions.md).

## Goal

An application the astronaut uses on board, without depending on Earth, to understand in time how changes in their health affect their performance and what to do about it. It answers the challenge *Create Health Monitoring Software for Astronauts on Space Missions* (NASA Space Apps Challenge 2026).

**Who uses it:** a crew member on a long mission, in the ship or in the field (a spacewalk or the surface). The demo crew has three synthetic people: a commander and a mission scientist in the ship, and a flight engineer in the field (D-010).

**What makes it different:**
- It compares each signal with **the person's own normal**, not with a general range.
- It confirms a change before alerting, with measured rates of false alarms and missed changes (D-011).
- It detects **combined patterns** across systems.
- It **forecasts** the next nights of sleep and the days left before the radiation career limit.
- It includes **radiation**: dose rate, accumulated dose, solar storms, the career limit and the organs at risk.
- **It works without Earth.**

**Acceptance criteria (the astronaut's stories):**
1. I see on one panel the state of my systems (cardiovascular, neurological, immune, ship environment and radiation), updated live.
2. When a signal moves away from my normal and the change is confirmed, I get an alert that says which signal, how far it moved, why it matters (with its NASA source) and what routine to follow.
3. When several systems move away at once, the alert says so as a combined pattern.
4. I see a forecast of the next nights of sleep and how many days are left before the radiation career limit.
5. In an emergency, such as a solar storm or reaching the career dose limit, the app gives me a step-by-step action guide without waiting for Earth.
6. I can switch between "in the ship" and "in the field". In the field the model is lighter and watches only portable sensors.
7. Earth's feedback appears when it arrives, with its delay visible. *Not built in this version.*
8. If something fails or is unclear, I report it from inside the app with "Report a problem".
9. With several crew members, each one has their own normal, alerts and place; one can be in the ship and another in the field at the same time, and I see at a glance who is where and how they are.

## Module map (modular monolith, hexagonal architecture)

| Id | Responsibility | Depends on |
|---|---|---|
| `domain` | Pure core with no input or output: readings, personal baselines and their prediction intervals, published lab variation, alert rules with their explanation, combined patterns, the sleep forecast, the radiation ledger, crew members and the ship and field models | — |
| `storage` | Readings per crew member in SQLite (Repository pattern) | `domain` |
| `ingestion` | Input adapters: the seeded simulator with the demo scripts, the OSD-569 blood count and OSD-575 metabolic panel loaders, the NASA DONKI event reader and the MSL RAD dose replay. Real sensors come next | `domain` |
| `feedback` | Testers' reports from inside the app, with their context, sent as GitHub issues or kept locally | `domain` |
| `api` | FastAPI: REST to query, and one WebSocket per crew member for live data; wires the use cases | all of the above |
| `web` | React: the crew strip, the body with a ring per system, the model analysis, folding details per system, radiation and actions, in English and Spanish | `api` |
| `earth-link` | Earth simulator that receives summaries and answers after a configurable delay. *Not built in this version.* | `domain` |

**Patterns:**
- Adapter: one adapter per data source.
- Strategy: the ship model and the field model.
- Observer, through an in-process event bus: reading, then evaluation, then alert, then screen.
- Repository: to store readings.
- Specification-style rules: every rule returns its own explanation.

## Stack

- **Backend:** Python 3.13, FastAPI, Pydantic 2, NumPy, SQLite (the standard `sqlite3` module) and Uvicorn. Versions are pinned in `backend/requirements.lock` (production) and `backend/requirements-dev.lock` (development). API tests use httpx2, the client Starlette recommends.
- **Frontend:** React 19, Vite, strict TypeScript and local IBM Plex fonts. Charts are hand-made SVG. `package-lock.json` is in the repository.
- **Quality:**
  - Ruff (lint and format), pytest, ESLint, Vitest with Testing Library, and gitleaks.
  - CI in GitHub Actions (`.github/workflows/ci.yml`) runs `scripts/verify.py`, `npm audit` and a Docker build with a smoke test, with actions pinned by hash.

## Commands

```
Backend, set up:   python -m venv backend/.venv
                   backend/.venv/bin/python -m pip install -r backend/requirements-dev.lock
                   (requirements.lock = production only; requirements-dev.lock = production + tests and lint)
Backend, run:      backend/.venv/bin/python -m uvicorn app.main:create_app --factory --app-dir backend --port 8000
Backend, lint:     backend/.venv/bin/python -m ruff check backend
Backend, tests:    backend/.venv/bin/python -m pytest backend/tests -q
Model validation:  cd backend && .venv/bin/python validate_model.py --people 200 --days 90
Frontend:          npm ci --prefix frontend
                   npm run dev --prefix frontend
                   npm run lint --prefix frontend
                   npm test --prefix frontend -- --run
                   npm run build --prefix frontend
Everything:        python scripts/verify.py      (lint, tests, build and gitleaks)
Offline demo:      python scripts/demo.py        (builds the panel and runs the simulated mission)
```

On Windows, use `.venv\Scripts\` instead of `.venv/bin/`.

## Project structure

```
backend/app/domain/        → pure logic: readings, baseline, variation, stats, rules, forecast, radiation, crew, modes, references, reports
backend/app/application/   → use cases: ingest, evaluate, forecast, track radiation, mission, crew, reports, event bus
backend/app/ports/         → interfaces (Protocol): ReadingSource, ExamScheduler, ReadingRepository
backend/app/adapters/      → simulator, demo scenarios and clock, SQLite repository, OSDR, DONKI and RAD loaders, report sinks
backend/app/api/           → FastAPI routes and WebSocket, Pydantic schemas
backend/tests/             → domain, application and API tests, plus a small validation sample
backend/validate_model.py  → measures false alarms and missed changes on synthetic people
frontend/src/features/     → crew strip, body and rings, model, radiation, actions, folding details, report form
frontend/src/i18n/         → English and Spanish texts
frontend/src/api/          → live state, WebSocket client and types
data/osdr/                 → the OSD-569 and OSD-575 CSV files, with their source and licence in a README
data/donki/                → the NASA DONKI answers for the March 2012 storm, with their source in a README
data/eda/                  → the ISS cabin temperature and CO2 by mission (NASA OSDR EDA) that the simulator is centred on
data/rad/                  → the dose that Curiosity's RAD measured in cruise (NASA PDS), with its source in a README
docs/decisions.md          → architecture and model decisions (D-001 to D-020)
scripts/                   → verify.py, demo.py, eda_cabin_summary.py (rebuilds data/eda) and build_rad_dose.py (rebuilds data/rad)
LICENSE, NOTICE            → Apache 2.0 and credits, including the NASA data citation
```

## Code style

- **Domain:** no FastAPI, SQLite or any input or output. Immutable types and pure functions:

```python
def beyond(self, z: float) -> str | None:
    """The direction if this reading is at least as unusual as `z` (judged with the
    prediction interval of its baseline) on a side that is a health concern."""
    if abs(self.z_score) < self.baseline.alert_z(z):
        return None
    concern = CONCERN[self.reading.signal]
    if concern is Concern.BOTH or concern.value == self.direction:
        return self.direction
    return None
```

- **Alerts:** every alert carries what it detected, with which value, against which normal, why it matters (with its NASA source) and what to do.
- **Errors:** no empty `except` and no defaults that hide a failure. An invalid reading is rejected with a clear error and logged.
- **Names and text:** code, commits and identifiers are in English. Screen text comes from `i18n`.
- **Frontend:** strict TypeScript, no `any`, no `innerHTML` with outside data. Status colours (green, amber, red) always come with an icon and a word.

## Testing strategy

- **Domain with pytest**, the most important part: baselines and their prediction intervals, published lab spreads, the confirmation rules, combined patterns, the forecast on a known series, the dose projection (256 mSv at 1.8 mSv per day gives 191 days), the 250 mSv event limit and the 600 mSv career limit.
- **API with FastAPI's TestClient:** the routes and the WebSocket, with the seeded simulator.
- **Web with Vitest and Testing Library:** the panel states (OK, attention, emergency), the folding details, the crew strip and the language switch.
- **Reproducible demo:** the seeded, accelerated mission shows the early warning first and the emergency after. A test checks it, and each lap of the script repeats the first one.
- **Model validation:** `validate_model.py` measures false alarms per astronaut-year and missed changes; a small sample runs with every change.
- **Every bug is first reproduced with a failing test.**

## Boundaries

- **Always:**
  - Run `python scripts/verify.py` before each commit, and gitleaks before each push.
  - Use only synthetic data or open NASA data.
  - Explain every alert.
  - Validate inputs.
- **Ask first:**
  - Adding dependencies.
  - Making the repository public.
  - Adding collaborators.
  - Deploying to the cloud.
  - Changing CI.
- **Never:**
  - Commit secrets (`.env`) or real people's data.
  - Delete a failing test without approval.
  - Present an alert as a diagnosis.

## Success criteria

1. On a clean clone, `python scripts/verify.py` passes.
2. With the network off, `python scripts/demo.py` starts the app and the panel updates live every second with the simulator.
3. Given a baseline and test readings, the model marks signals outside the person's normal (±1.5 standard deviations) and alerts only when the change is confirmed: 10 live readings in a row, 3 of the last 4 days, or an exam and its repeat (D-011). When two or more systems have confirmed alerts at once, the combined pattern appears. Every alert shows the signal, the value, its normal, the reason and the source.
4. The 3-night sleep forecast and the days left before 600 mSv match the calculations in the tests.
5. A solar storm (the one RAD measured on 8 March 2012, replayed) and reaching the career limit both trigger the emergency path with the action guide (D-020).
6. Earth's feedback arrives with the configured delay and the screen shows how long is left. *Not met: not built in this version.*
7. The demo scenario (seeded, accelerated mission) is repeatable: it shows the early warning first and the emergency after.
8. The interface opens in the browser's language (English or Spanish) and can switch between them.
9. The commander's white blood cell and glucose set points come from OSD-569 and OSD-575, with the study visible on screen, and the demo storm names its real reference event from NASA DONKI (D-017).
10. The app is published at a Render URL and updates itself on every change to `main` (D-009).
11. Testers using the app as astronauts from their own browser can send a report with "Report a problem". It arrives as a GitHub issue with its context.
12. `python validate_model.py` (in `backend/`), with 200 synthetic people over 90 days in the ship and in the field, gives at most one false alarm every 10 astronaut-years and at most 1% of the scripted changes missed within 10 days (D-011).
13. The simulated cabin temperature and CO2 are centred on the ISS cabin summarised in `data/eda` from NASA OSDR's Environmental Data App, and a test keeps the simulator in step with it (D-019).

## Out of scope

- **Real medical diagnosis:** this is decision support.
- **Login and accounts.**
- **A mobile app.** The published web works in a phone browser.
- **Real people's data.** Apart from the open, anonymised OSD-569 and OSD-575 datasets, no person's data is used. The radiation dose is RAD's measurement inside a spacecraft; every other reading is synthetic.
- **Real sensors** in this version: the data is synthetic (D-005). The ingestion port is ready for them.
- **An app for the Earth side,** the real DTN protocol and orbital mechanics.

## Decisions

In [docs/decisions.md](docs/decisions.md):
- D-001: hexagonal modular monolith.
- D-002: Python with FastAPI, and React with TypeScript.
- D-003: private repository until submission.
- D-004: Mars.
- D-005: synthetic data.
- D-006: testers act as outside users and report from inside the app.
- D-007: Apache 2.0 licence.
- D-008: language.
- D-009: publishing on Render as a single service.
- D-010: several crew members, one mission per person.
- D-011: confirmed alerts, with targets for false alarms and missed changes.
- D-012: the radiation career limit is an emergency, with no invented threshold.

## Open questions

1. **Real sensors:** a teammate has worked with an AD8232 ECG module on an ESP32 and has recordings. Using them needs written consent from the person recorded and no identifying data.
