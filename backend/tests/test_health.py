from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_reports_ok() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_any_page_can_read_whether_the_app_is_up_but_nothing_else() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))

    health = client.get("/health", headers={"Origin": "https://example.org"})
    crew = client.get("/api/crew", headers={"Origin": "https://example.org"})

    assert health.headers["access-control-allow-origin"] == "*"
    assert "access-control-allow-origin" not in crew.headers
