import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .core.settings import settings
from .services.aggregates import AggregateStore
from .services.movie_catalog import MovieCatalog
from .services.redis_bus import RedisBus
from .ws.manager import WebSocketManager


ws_manager = WebSocketManager()
aggregate_store = AggregateStore(max_items_per_type=settings.max_cache_items_per_type)
redis_bus = RedisBus(settings.redis_url, settings.redis_stream_key)
movie_catalog = MovieCatalog(
    str((Path(__file__).resolve().parent / settings.movie_catalog_path).resolve())
)


async def _event_dispatch_loop() -> None:
    async for event in redis_bus.consume(
        cursor="$", block_ms=settings.redis_consumer_block_ms
    ):
        event = movie_catalog.enrich_event(event)
        seq = aggregate_store.push(event)
        room = event.get("type", "unknown")

        payload = {
            "kind": "PATCH",
            "seq": seq,
            "room": room,
            "event": event,
            "ts": datetime.now(timezone.utc).isoformat(),
        }

        await ws_manager.broadcast(room=room, payload=payload)

        severity = str(event.get("severity", "normal"))
        if severity in {"elevated", "critical"}:
            await ws_manager.broadcast(
                room="alerts",
                payload={
                    "kind": "ALERT",
                    "seq": seq,
                    "severity": severity,
                    "event": event,
                    "ts": datetime.now(timezone.utc).isoformat(),
                },
            )


async def _heartbeat_loop() -> None:
    while True:
        await ws_manager.broadcast_all(
            {
                "kind": "HEARTBEAT",
                "ts": datetime.now(timezone.utc).isoformat(),
            }
        )
        await asyncio.sleep(settings.heartbeat_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await redis_bus.connect()
    dispatch_task = asyncio.create_task(
        _event_dispatch_loop(), name="redis-dispatch-loop"
    )
    heartbeat_task = asyncio.create_task(_heartbeat_loop(), name="heartbeat-loop")
    try:
        yield
    finally:
        dispatch_task.cancel()
        heartbeat_task.cancel()
        await redis_bus.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": settings.app_name,
        "time": datetime.now(timezone.utc).isoformat(),
        "sequence": aggregate_store.sequence(),
        "connections": ws_manager.client_count(),
    }


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    return {
        "service": settings.app_name,
        "time": datetime.now(timezone.utc).isoformat(),
        "sequence": aggregate_store.sequence(),
        "connections": ws_manager.client_count(),
        "room_counts": ws_manager.room_counts(),
        "by_type_counts": aggregate_store.by_type_counts(),
    }


@app.get("/snapshot")
def snapshot(rooms: str | None = None) -> dict[str, Any]:
    selected_rooms = []
    if rooms:
        selected_rooms = [r.strip() for r in rooms.split(",") if r.strip()]

    state = aggregate_store.snapshot(selected_rooms)
    return {
        "kind": "SNAPSHOT",
        "ts": datetime.now(timezone.utc).isoformat(),
        "state": state,
    }


@app.websocket("/ws/stream")
async def stream(websocket: WebSocket) -> None:
    connection_id = await ws_manager.connect(websocket)
    try:
        await ws_manager.send_json(
            connection_id,
            {
                "kind": "CONNECTED",
                "connection_id": connection_id,
                "ts": datetime.now(timezone.utc).isoformat(),
            },
        )

        # Initial full snapshot for this client.
        await ws_manager.send_json(
            connection_id,
            {
                "kind": "SNAPSHOT",
                "seq": aggregate_store.sequence(),
                "state": aggregate_store.snapshot(),
            },
        )

        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "subscribe":
                rooms = data.get("rooms", [])
                await ws_manager.subscribe(connection_id, rooms)
                await ws_manager.send_json(
                    connection_id,
                    {
                        "kind": "SUBSCRIBED",
                        "rooms": ws_manager.rooms_for(connection_id),
                    },
                )

            elif action == "unsubscribe":
                rooms = data.get("rooms", [])
                await ws_manager.unsubscribe(connection_id, rooms)
                await ws_manager.send_json(
                    connection_id,
                    {
                        "kind": "UNSUBSCRIBED",
                        "rooms": ws_manager.rooms_for(connection_id),
                    },
                )

            elif action == "snapshot":
                rooms = data.get("rooms", [])
                await ws_manager.send_json(
                    connection_id,
                    {
                        "kind": "SNAPSHOT",
                        "seq": aggregate_store.sequence(),
                        "state": aggregate_store.snapshot(rooms),
                    },
                )

            elif action == "heartbeat":
                await ws_manager.send_json(
                    connection_id,
                    {
                        "kind": "HEARTBEAT_ACK",
                        "server_ts": datetime.now(timezone.utc).isoformat(),
                        "client_ts": data.get("ts"),
                    },
                )

    except WebSocketDisconnect:
        await ws_manager.disconnect(connection_id)
    except Exception:
        await ws_manager.disconnect(connection_id)
