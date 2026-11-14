"""REST views and the live WebSocket, per crew member."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.application.crew import CrewSlot
from app.application.serializers import reading_to_dict
from app.container import Container
from app.domain.crew import UnknownCrewMemberError
from app.domain.modes import Mode
from app.domain.readings import Signal

router = APIRouter()


def _container(app_state: Any) -> Container:
    container: Container = app_state.container
    return container


def _slot(app_state: Any, crew_id: str) -> CrewSlot:
    try:
        return _container(app_state).crew.get(crew_id)
    except UnknownCrewMemberError as error:
        raise HTTPException(status_code=404, detail=f"Unknown crew member: {crew_id}") from error


@router.get("/api/crew")
def crew(request: Request) -> dict[str, Any]:
    return _container(request.app.state).crew.summary()


@router.get("/api/crew/{crew_id}/snapshot")
def snapshot(request: Request, crew_id: str) -> dict[str, Any]:
    latest = _slot(request.app.state, crew_id).repository.latest()
    return {"readings": [reading_to_dict(r) for r in latest.values()]}


@router.get("/api/crew/{crew_id}/history/{signal}")
def history(
    request: Request, crew_id: str, signal: str, limit: int = Query(default=48, ge=1, le=1000)
) -> dict[str, Any]:
    slot = _slot(request.app.state, crew_id)
    try:
        known = Signal(signal)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=f"Unknown signal: {signal}") from error
    readings = slot.repository.history(known, limit)
    return {"signal": known.value, "readings": [reading_to_dict(r) for r in readings]}


@router.get("/api/crew/{crew_id}/evaluation")
def evaluation(request: Request, crew_id: str) -> dict[str, Any]:
    return _slot(request.app.state, crew_id).mission.evaluate.view()


class ModeChange(BaseModel):
    mode: Mode


@router.get("/api/crew/{crew_id}/mode")
def get_mode(request: Request, crew_id: str) -> dict[str, str]:
    return {"mode": _slot(request.app.state, crew_id).mission.evaluate.mode.value}


@router.put("/api/crew/{crew_id}/mode")
def put_mode(request: Request, crew_id: str, change: ModeChange) -> dict[str, str]:
    _slot(request.app.state, crew_id)
    mode = _container(request.app.state).crew.set_mode(crew_id, change.mode)
    return {"mode": mode.value}


@router.get("/api/crew/{crew_id}/forecast")
def forecast(request: Request, crew_id: str) -> dict[str, Any]:
    return _slot(request.app.state, crew_id).mission.forecast.view()


@router.get("/api/crew/{crew_id}/radiation")
def radiation(request: Request, crew_id: str) -> dict[str, Any]:
    return _slot(request.app.state, crew_id).mission.radiation.view()


@router.websocket("/ws/crew/{crew_id}/live")
async def live(websocket: WebSocket, crew_id: str) -> None:
    container = _container(websocket.app.state)
    try:
        slot = container.crew.get(crew_id)
    except UnknownCrewMemberError:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    queue = slot.bus.subscribe()
    try:
        latest = slot.repository.latest()
        await websocket.send_json(
            {"type": "snapshot", "readings": [reading_to_dict(r) for r in latest.values()]}
        )
        await websocket.send_json(slot.mission.evaluate.view())
        await websocket.send_json(slot.mission.radiation.view())
        await websocket.send_json(slot.mission.clock_view())
        await websocket.send_json(slot.mission.forecast.view())
        await websocket.send_json(container.crew.summary())
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        return
    finally:
        slot.bus.unsubscribe(queue)
