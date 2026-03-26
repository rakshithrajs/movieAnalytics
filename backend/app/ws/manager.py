import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._clients: dict[str, WebSocket] = {}
        self._rooms: dict[str, set[str]] = defaultdict(set)
        self._client_rooms: dict[str, set[str]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        connection_id = str(uuid4())
        async with self._lock:
            self._clients[connection_id] = websocket
        return connection_id

    async def disconnect(self, connection_id: str) -> None:
        async with self._lock:
            self._clients.pop(connection_id, None)
            rooms = self._client_rooms.pop(connection_id, set())
            for room in rooms:
                self._rooms[room].discard(connection_id)

    async def subscribe(self, connection_id: str, rooms: list[str]) -> None:
        async with self._lock:
            for room in rooms:
                self._rooms[room].add(connection_id)
                self._client_rooms[connection_id].add(room)

    async def unsubscribe(self, connection_id: str, rooms: list[str]) -> None:
        async with self._lock:
            for room in rooms:
                self._rooms[room].discard(connection_id)
                self._client_rooms[connection_id].discard(room)

    async def send_json(self, connection_id: str, payload: dict[str, Any]) -> None:
        websocket = self._clients.get(connection_id)
        if websocket is None:
            return
        await websocket.send_text(json.dumps(payload, default=self._json_default))

    async def broadcast(self, room: str, payload: dict[str, Any]) -> None:
        recipients = list(self._rooms.get(room, set()))
        if not recipients:
            return

        message = json.dumps(payload, default=self._json_default)
        stale_connections: list[str] = []

        for connection_id in recipients:
            websocket = self._clients.get(connection_id)
            if websocket is None:
                stale_connections.append(connection_id)
                continue
            try:
                await websocket.send_text(message)
            except Exception:
                stale_connections.append(connection_id)

        for connection_id in stale_connections:
            await self.disconnect(connection_id)

    async def broadcast_all(self, payload: dict[str, Any]) -> None:
        recipients = list(self._clients.keys())
        if not recipients:
            return

        message = json.dumps(payload, default=self._json_default)
        stale_connections: list[str] = []

        for connection_id in recipients:
            websocket = self._clients.get(connection_id)
            if websocket is None:
                stale_connections.append(connection_id)
                continue
            try:
                await websocket.send_text(message)
            except Exception:
                stale_connections.append(connection_id)

        for connection_id in stale_connections:
            await self.disconnect(connection_id)

    def rooms_for(self, connection_id: str) -> list[str]:
        return sorted(list(self._client_rooms.get(connection_id, set())))

    def client_count(self) -> int:
        return len(self._clients)

    def room_counts(self) -> dict[str, int]:
        return {room: len(client_ids) for room, client_ids in self._rooms.items()}

    @staticmethod
    def _json_default(value: Any):
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).isoformat()
        return str(value)
