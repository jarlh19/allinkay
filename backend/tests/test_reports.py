from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.adapters.report_sinks import FallbackSink, GitHubIssueSink, SinkError, SqliteReportSink
from app.application.reports import Limits, RateLimitedError, SubmitReport
from app.config import Settings
from app.domain.reports import InvalidReportError, ProblemReport
from app.main import create_app

NOW = datetime(2026, 11, 14, 15, 0, tzinfo=UTC)


def report(
    what: str = "The sleep card does not update", screen: str = "neurological"
) -> ProblemReport:
    return ProblemReport.create(
        what, "It should update daily", screen, "Aranza", 93, "ship", "es", NOW
    )


def test_report_cleans_text_and_builds_a_short_title() -> None:
    long_text = "The forecast chart overlaps the legend on my phone " * 3
    built = ProblemReport.create(long_text + "\x00", "", "model", "", None, "moon", "fr", NOW)

    assert "\x00" not in built.what_happened
    assert built.title.startswith("[Tester report] model: The forecast chart")
    assert len(built.title) <= 90
    assert (built.mode, built.language) == ("ship", "en")
    assert "**Mission day:** unknown" in built.to_markdown()


@pytest.mark.parametrize(
    ("what", "screen", "message"),
    [
        ("   ", "model", "required"),
        ("ok", "kitchen", "Unknown screen"),
        ("x" * 2001, "model", "longer"),
    ],
)
def test_invalid_reports_are_rejected(what: str, screen: str, message: str) -> None:
    with pytest.raises(InvalidReportError, match=message):
        ProblemReport.create(what, "", screen, "", None, "ship", "en", NOW)


def test_local_sink_stores_and_exports_markdown() -> None:
    sink = SqliteReportSink(":memory:")

    reference = sink.submit(report())

    assert reference == "local-1"
    assert "### What happened" in sink.export_markdown()


def test_github_sink_creates_an_issue_with_the_token() -> None:
    calls: list[tuple[str, dict[str, str], dict[str, object]]] = []

    def fake_post(
        url: str, headers: dict[str, str], payload: dict[str, object]
    ) -> dict[str, object]:
        calls.append((url, headers, payload))
        return {"number": 12}

    reference = GitHubIssueSink("jarlh19/allinkay", "secret", post=fake_post).submit(report())

    assert reference == "#12"
    url, headers, payload = calls[0]
    assert url == "https://api.github.com/repos/jarlh19/allinkay/issues"
    assert headers["Authorization"] == "Bearer secret"
    assert str(payload["title"]).startswith("[Tester report] neurological")


def test_github_failure_keeps_the_report_locally() -> None:
    def failing_post(
        url: str, headers: dict[str, str], payload: dict[str, object]
    ) -> dict[str, object]:
        raise OSError("network down")

    local = SqliteReportSink(":memory:")
    sink = FallbackSink(GitHubIssueSink("jarlh19/allinkay", "t", post=failing_post), local)

    assert sink.submit(report()) == "local-1"


def test_github_answer_without_number_is_an_error() -> None:
    sink = GitHubIssueSink("jarlh19/allinkay", "t", post=lambda u, h, p: {})

    with pytest.raises(SinkError, match="issue number"):
        sink.submit(report())


def test_rate_limit_per_sender_and_reset_after_the_window() -> None:
    now = NOW
    use_case = SubmitReport(SqliteReportSink(":memory:"), lambda: now, Limits(per_sender=2))
    use_case.submit(report(), "1.1.1.1")
    use_case.submit(report(), "1.1.1.1")

    with pytest.raises(RateLimitedError):
        use_case.submit(report(), "1.1.1.1")
    use_case.submit(report(), "2.2.2.2")
    now = NOW + timedelta(minutes=11)
    use_case.submit(report(), "1.1.1.1")


def test_report_endpoint_and_export_switch() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))
    body = {"what_happened": "Panel froze", "screen": "model", "mission_day": 96, "language": "es"}

    created = client.post("/api/reports", json=body)

    assert created.status_code == 201
    assert created.json() == {"reference": "local-1", "destination": "local"}
    assert client.post("/api/reports", json={**body, "screen": "kitchen"}).status_code == 422
    assert client.post("/api/reports", json={**body, "what_happened": ""}).status_code == 422
    assert client.get("/api/reports.md").status_code == 404

    exporting = TestClient(
        create_app(Settings(db_path=":memory:", run_live_loop=False, reports_export=True))
    )
    exporting.post("/api/reports", json=body)
    assert "Panel froze" in exporting.get("/api/reports.md").text


def test_report_endpoint_rate_limits_by_forwarded_address() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))
    body = {"what_happened": "Panel froze"}
    headers = {"X-Forwarded-For": "9.9.9.9, 10.0.0.1"}

    codes = [client.post("/api/reports", json=body, headers=headers).status_code for _ in range(6)]

    assert codes == [201] * 5 + [429]


def test_report_names_the_crew_member_being_watched() -> None:
    watched = ProblemReport.create(
        "Mode did not change", "", "overall", "", 96, "field", "es", NOW, crew="engineer"
    )

    assert "**Crew member:** engineer" in watched.to_markdown()
    assert "**Crew member:** not given" in report().to_markdown()


def test_report_endpoint_accepts_only_known_crew_members() -> None:
    client = TestClient(create_app(Settings(db_path=":memory:", run_live_loop=False)))
    body = {"what_happened": "Panel froze", "crew": "engineer"}

    assert client.post("/api/reports", json=body).status_code == 201
    assert client.post("/api/reports", json={**body, "crew": "pilot"}).status_code == 422
