"""Where tester reports go: GitHub issues in the deployed app, SQLite when running locally."""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import urllib.request
from collections.abc import Callable
from pathlib import Path

from app.domain.reports import ProblemReport

logger = logging.getLogger(__name__)

PostJson = Callable[[str, dict[str, str], dict[str, object]], dict[str, object]]


class SinkError(RuntimeError):
    """The report could not be delivered."""


def _post_json(url: str, headers: dict[str, str], payload: dict[str, object]) -> dict[str, object]:
    request = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        body: dict[str, object] = json.loads(response.read().decode("utf-8"))
        return body


class GitHubIssueSink:
    destination = "github"

    def __init__(self, repo: str, token: str, post: PostJson = _post_json) -> None:
        if "/" not in repo:
            raise ValueError(f"GitHub repo must look like owner/name, got {repo!r}")
        self._url = f"https://api.github.com/repos/{repo}/issues"
        self._token = token
        self._post = post

    def submit(self, report: ProblemReport) -> str:
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "allinkay-app",
        }
        try:
            created = self._post(
                self._url, headers, {"title": report.title, "body": report.to_markdown()}
            )
        except Exception as error:
            raise SinkError(f"GitHub did not accept the report: {error}") from error
        number = created.get("number")
        if number is None:
            raise SinkError("GitHub answered without an issue number")
        return f"#{number}"


class SqliteReportSink:
    destination = "local"

    def __init__(self, path: str | Path) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, "
            "title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)"
        )

    def submit(self, report: ProblemReport) -> str:
        with self._lock, self._conn:
            cursor = self._conn.execute(
                "INSERT INTO reports (title, body, created_at) VALUES (?, ?, ?)",
                (report.title, report.to_markdown(), report.created_at.isoformat()),
            )
        return f"local-{cursor.lastrowid}"

    def export_markdown(self) -> str:
        with self._lock:
            rows = self._conn.execute("SELECT id, title, body FROM reports ORDER BY id").fetchall()
        return "\n\n---\n\n".join(f"## {rid}. {title}\n\n{body}" for rid, title, body in rows)


class FallbackSink:
    """Tries the primary sink and keeps the report locally if it fails, saying so in the log."""

    def __init__(self, primary: GitHubIssueSink, fallback: SqliteReportSink) -> None:
        self._primary = primary
        self._fallback = fallback
        self.destination = primary.destination

    def submit(self, report: ProblemReport) -> str:
        try:
            return self._primary.submit(report)
        except SinkError:
            logger.exception("Report kept locally because GitHub failed")
            return self._fallback.submit(report)
