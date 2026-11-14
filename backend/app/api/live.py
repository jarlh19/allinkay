"""REST snapshot and WebSocket stream of live readings."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect

from app.application.serializers import reading_to_dict
from app.container import Container
from app.domain.readings import Signal

router = APIRouter()


def _container(app_state: Any) -> Container:
    container: Container = app_state.container
    return container


@router.get("/api/snapshot")
def snapshot(request: Request) -> dict[str, Any]:
    latest = _container(request.app.state).repository.latest()
    return {"readings": [reading_to_dict(r) for r in latest.values()]}


@router.get("/api/history/{signal}")
def history(
    request: Request, signal: str, limit: int = Query(default=48, ge=1, le=1000)
) -> dict[str, Any]:
    try:
        known = Signal(signal)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=f"Unknown signal: {signal}") from error
    readings = _container(request.app.state).repository.history(known, limit)
    return {"signal": known.value, "readings": [reading_to_dict(r) for r in readings]}


@router.get("/api/evaluation")
def evaluation(request: Request) -> dict[str, Any]:
    return _container(request.app.state).evaluate.view()


@router.get("/api/radiation")
def radiation(request: Request) -> dict[str, Any]:
    return _container(request.app.state).radiation.view()


@router.websocket("/ws/live")
async def live(websocket: WebSocket) -> None:
    container = _container(websocket.app.state)
    await websocket.accept()
    queue = container.bus.subscribe()
    try:
        latest = container.repository.latest()
        await websocket.send_json(
            {"type": "snapshot", "readings": [reading_to_dict(r) for r in latest.values()]}
        )
        await websocket.send_json(container.evaluate.view())
        await websocket.send_json(container.radiation.view())
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        return
    finally:
        container.bus.unsubscribe(queue)
