from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_security_headers_are_set_on_api_responses() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))

    headers = client.get("/health").headers

    assert "default-src 'self'" in headers["content-security-policy"]
    assert headers["x-content-type-options"] == "nosniff"
    assert headers["x-frame-options"] == "DENY"


def test_built_frontend_is_served_and_api_keeps_priority(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<h1>ALLINKAY</h1>", encoding="utf-8")
    settings = Settings(db_path=":memory:", run_live_loop=False, static_dir=str(tmp_path))
    client = TestClient(create_app(settings))

    assert "ALLINKAY" in client.get("/").text
    assert client.get("/health").json() == {"status": "ok"}


def test_missing_frontend_build_fails_loudly(tmp_path: Path) -> None:
    settings = Settings(db_path=":memory:", run_live_loop=False, static_dir=str(tmp_path))

    with pytest.raises(RuntimeError, match="Frontend build not found"):
        create_app(settings)
