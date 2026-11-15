# Hardware roadmap (beta, planned)

> **Status: planned, not built.** The live app runs on simulated sensors. Nothing in this document has been assembled or tested yet. It records where ALLINKAY is heading after the hackathon.

## Goal

Run ALLINKAY on real sensors and on a computer that stays on board, with no connection to Earth. The model, the rules and the screen stay the same: only the source of the readings changes.

## How it fits the current design

The backend is a hexagonal monolith. Today the readings come from a simulator adapter (`backend/app/adapters/simulator.py`). A sensor adapter would take its place behind the same port, so the model and the screen do not change.

```
wearable and cabin sensors
        │  (analog / I²C)
        ▼
ESP32 sensor hub  ──(USB serial or MQTT on the local network)──►  onboard computer
                                                                   │  ALLINKAY backend
                                                                   │  (sensor adapter → model → alerts)
                                                                   ▼
                                                                   3D screen in the cabin
```

## Proposed parts

| Part | Role | Signals it would feed |
|---|---|---|
| NVIDIA Jetson Orin Nano | Onboard computer: runs the backend, the model and the 3D screen offline | All |
| ESP32 (for example an Arduino Nano ESP32) | Sensor hub: reads the sensors and sends the readings | All sensor signals |
| AD8232 | Single-lead electrocardiogram | Heart rate |
| MAX30102 | Pulse oximetry | Oxygen saturation, pulse |
| MAX30205 | Skin temperature | Body temperature |
| SCD41 | NDIR CO₂, temperature and humidity | Cabin CO₂, cabin temperature |
| BME280 | Pressure, temperature and humidity | Cabin pressure |
| MPU-6050 | Wrist motion (actigraphy) | Sleep estimate |

Blood pressure, lab exams, mood and reaction time stay as manual entries or in-app tests: there is no cheap, reliable sensor for them.

**Why these choices**

- **Jetson Orin Nano:** low power, runs Linux and the whole stack, and its GPU leaves room for heavier models later (for example on the electrocardiogram). The current model is light and would also run on a smaller board such as a Raspberry Pi 5; the Orin is the option that does not limit the next steps.
- **ESP32:** Wi-Fi and Bluetooth built in, enough analog inputs, and the team already has experience with it.

## Milestones

1. **Bench prototype:** ESP32 with AD8232 and MAX30102 streaming to a sensor adapter on a laptop; the app shows real heart rate and oxygen saturation next to the simulated signals.
   - *Started:* the team's biomedical engineer made a first bench recording of a heart signal with skin electrodes. It already gives beat-to-beat intervals (0.88 to 1.20 s), but it samples only about 4 points per beat and its heart-rate output was fixed at 72. Next: sample at 250 Hz and compute the heart rate from the intervals. Used with her consent; the raw recording stays off this repository.
2. **Cabin sensors:** SCD41 and BME280 feeding the ship environment system.
3. **On board:** the full stack on the Jetson Orin Nano, with no network connection.
4. **Validation:** compare every reading against a reference medical device before any use with people; tune the personal baselines on real data (see `backend/validate_model.py`).

## Limits and safeguards

- None of these parts is rated for spaceflight (radiation, vibration, thermal). This is a ground prototype.
- ALLINKAY is decision support, not a diagnosis or a medical device.
- Real readings are health data. They need the written consent of the person measured, stay on the device, and never go into this repository.
