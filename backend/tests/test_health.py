from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_reports_ok() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
