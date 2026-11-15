from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.adapters.scenario import DEMO
from app.config import Settings
from app.container import Container
from app.domain.crew import CrewMember, UnknownCrewMemberError
from app.domain.modes import Mode
from app.domain.readings import Reading
from app.main import create_app

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=UTC)


def quiet_container() -> Container:
    return Container.build(Settings(db_path=":memory:", run_live_loop=False), clock=lambda: NOW)


def first_alerts_per_member(days: int) -> dict[tuple[str, str, tuple[str, ...]], float]:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    seen: dict[tuple[str, str, tuple[str, ...]], float] = {}
    for hour in range(days * 24):
        now = DEMO.start + timedelta(hours=hour)
        container.crew.step(now)
        for slot in container.crew:
            for alert in slot.mission.evaluate.view()["alerts"]:
                key = (slot.member.id, alert["kind"], tuple(alert["signals"]))
                seen.setdefault(key, hour / 24)
    return seen


def test_the_crew_starts_with_the_engineer_outside() -> None:
    members = quiet_container().crew.summary()["members"]

    assert [(m["id"], m["mode"], m["status"]) for m in members] == [
        ("commander", "ship", "normal"),
        ("engineer", "field", "normal"),
        ("scientist", "ship", "normal"),
    ]


def test_crew_members_do_not_share_readings() -> None:
    container = quiet_container()
    container.crew.step(NOW)

    commander = container.crew.get("commander").repository.latest()
    engineer = container.crew.get("engineer").repository.latest()

    assert len(commander) == len(engineer) == 16
    assert any(commander[s].value != engineer[s].value for s in commander)


def test_an_unknown_crew_member_is_an_error() -> None:
    with pytest.raises(UnknownCrewMemberError):
        quiet_container().crew.get("pilot")


def test_crew_ids_must_be_slugs() -> None:
    with pytest.raises(ValueError):
        CrewMember(id="Pilot One", role="pilot", mode=Mode.SHIP, career_dose_msv=0)


def test_changing_one_mode_tells_every_channel_once() -> None:
    container = quiet_container()
    queues = [slot.bus.subscribe() for slot in container.crew]

    container.crew.set_mode("scientist", Mode.FIELD)
    container.crew.publish_summary()

    for queue in queues:
        crew_events = []
        while not queue.empty():
            event = queue.get_nowait()
            if event["type"] == "crew":
                crew_events.append(event)
        assert len(crew_events) == 1
        modes = {m["id"]: m["mode"] for m in crew_events[0]["members"]}
        assert modes == {"commander": "ship", "engineer": "field", "scientist": "field"}


def test_each_member_follows_their_own_script_in_the_demo() -> None:
    seen = first_alerts_per_member(days=9)

    engineer = {k: v for k, v in seen.items() if k[0] == "engineer"}
    scientist = {k: v for k, v in seen.items() if k[0] == "scientist"}
    assert set(engineer) == {
        ("engineer", "outside_normal", ("heart_rate",)),
        ("engineer", "outside_normal", ("body_temperature",)),
        ("engineer", "outside_normal", ("dose_today",)),
        ("engineer", "solar_storm", ("dose_today",)),
    }
    assert 5 < engineer[("engineer", "outside_normal", ("heart_rate",))] < 8
    # The scientist stays well; only the measured storm reaches them.
    assert set(scientist) == {
        ("scientist", "outside_normal", ("dose_today",)),
        ("scientist", "solar_storm", ("dose_today",)),
    }
    storms = [v for k, v in seen.items() if k[1] == "solar_storm"]
    assert len(storms) == 3
    assert all(8 <= day < 8.3 for day in storms)
    # RAD's dose climbed for a day before the storm threshold: everyone's dose leaves their
    # normal on day 7, before the storm emergency on day 8.
    rising = [v for k, v in seen.items() if k[1:] == ("outside_normal", ("dose_today",))]
    assert len(rising) == 3
    assert all(7 <= day < max(storms) for day in rising)


def test_every_lap_of_the_demo_repeats_the_first() -> None:
    now = DEMO.start
    container = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: now, scenario=DEMO
    )
    values: dict[int, list[float]] = {0: [], 1: []}
    for lap in (0, 1):
        for hour in range(0, 10 * 24, 7):
            now = DEMO.start + timedelta(days=10 * lap, hours=hour)
            readings = container.crew.get("scientist").mission.ingest.tick(now)
            values[lap].extend(r.value for r in readings if r.signal.value == "heart_rate")

    assert values[0] == values[1]


def test_crew_api_lists_members_and_rejects_unknown_ones() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))

    members = client.get("/api/crew").json()["members"]

    assert [m["id"] for m in members] == ["commander", "engineer", "scientist"]
    assert client.get("/api/crew/pilot/evaluation").status_code == 404
    assert client.put("/api/crew/pilot/mode", json={"mode": "ship"}).status_code == 404


def test_changing_the_engineer_mode_leaves_the_commander_alone() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))

    assert client.put("/api/crew/engineer/mode", json={"mode": "ship"}).json() == {"mode": "ship"}
    assert client.get("/api/crew/commander/mode").json() == {"mode": "ship"}
    assert client.get("/api/crew/engineer/mode").json() == {"mode": "ship"}
    assert client.put("/api/crew/commander/mode", json={"mode": "field"}).json() == {
        "mode": "field"
    }
    assert client.get("/api/crew/engineer/mode").json() == {"mode": "ship"}


def test_live_channel_of_one_member_starts_with_their_view_and_the_crew() -> None:
    app = create_app(Settings(db_path=":memory:", run_live_loop=False))

    with TestClient(app) as client, client.websocket_connect("/ws/crew/engineer/live") as ws:
        types = [ws.receive_json()["type"] for _ in range(6)]

    assert types == ["snapshot", "evaluation", "radiation", "clock", "forecast", "crew"]


def test_live_channel_of_an_unknown_member_is_refused() -> None:
    from starlette.websockets import WebSocketDisconnect

    app = create_app(Settings(db_path=":memory:", run_live_loop=False))
    with (
        TestClient(app) as client,
        pytest.raises(WebSocketDisconnect),
        client.websocket_connect("/ws/crew/pilot/live") as ws,
    ):
        ws.receive_json()


def test_the_deployed_demo_advances_exactly_one_step_per_tick() -> None:
    settings = Settings(db_path=":memory:", run_live_loop=False, scenario="demo", speed=3600)
    container = Container.build(settings)

    ticks = [container.clock() for _ in range(3)]

    assert ticks == [DEMO.start + timedelta(hours=n) for n in range(3)]


def lab_sources(container: Container, crew_id: str) -> dict[str, str]:
    """The source of each lab normal, as the screen receives it after one exam of each."""
    evaluate = container.crew.get(crew_id).mission.evaluate
    evaluate.on_readings(
        [
            Reading.create("white_blood_cells", 6.0, NOW, "test"),
            Reading.create("glucose", 78, NOW, "test"),
        ]
    )
    return {d["signal"]: d["baseline_source"] for d in evaluate.view()["deviations"]}


def test_the_commander_lab_normals_come_from_open_nasa_data() -> None:
    container = quiet_container()

    commander = lab_sources(container, "commander")
    assert commander["white_blood_cells"].startswith("NASA OSDR OSD-569 (C001")
    assert commander["glucose"].startswith("NASA OSDR OSD-575 (C001")
    engineer = lab_sources(container, "engineer")
    assert not engineer["glucose"].startswith("NASA OSDR")


def test_only_the_demo_storm_names_its_real_reference_event() -> None:
    demo = Container.build(
        Settings(db_path=":memory:", run_live_loop=False), clock=lambda: NOW, scenario=DEMO
    )
    for slot in demo.crew:
        reference = slot.mission.radiation.view()["storm_reference"]
        assert reference["sep_id"] == "2012-03-07T04:05:00-SEP-001"
        assert reference["flare_class"] == "X5.4"

    assert (
        quiet_container().crew.get("commander").mission.radiation.view()["storm_reference"] is None
    )
