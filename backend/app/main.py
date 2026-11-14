from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.live import router as live_router
from app.config import Settings
from app.container import Clock, Container, utc_now

logger = logging.getLogger(__name__)


async def run_live_loop(container: Container) -> None:
    """Pull due readings on a fixed interval. A failed tick is logged and the loop goes on."""
    while True:
        try:
            container.ingest.tick(container.clock())
        except Exception:
            logger.exception("Live tick failed")
        await asyncio.sleep(container.settings.tick_seconds)


def create_app(settings: Settings | None = None, clock: Clock = utc_now) -> FastAPI:
    resolved = settings or Settings.from_env()
    container = Container.build(resolved, clock)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task = asyncio.create_task(run_live_loop(container)) if resolved.run_live_loop else None
        try:
            yield
        finally:
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            container.repository.close()

    app = FastAPI(title="ALLINKAY", version="0.1.0", lifespan=lifespan)
    app.state.container = container
    app.include_router(health_router)
    app.include_router(live_router)
    return app
