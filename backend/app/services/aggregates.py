from collections import deque
from threading import Lock
from typing import Any, Dict


class AggregateStore:
    def __init__(self, max_items_per_type: int = 1000):
        self._max_items = max_items_per_type
        self._lock = Lock()
        self._by_type: dict[str, deque[dict[str, Any]]] = {}
        self._last_by_entity: dict[str, dict[str, Any]] = {}
        self._seq = 0

    def push(self, event: dict[str, Any]) -> int:
        event_type = str(event.get("type", "unknown"))
        entity = self._entity_key(event_type, event)

        with self._lock:
            self._seq += 1
            event["seq"] = self._seq

            if event_type not in self._by_type:
                self._by_type[event_type] = deque(maxlen=self._max_items)

            self._by_type[event_type].append(event)
            self._last_by_entity[entity] = event
            return self._seq

    def snapshot(self, rooms: list[str] | None = None) -> Dict[str, Any]:
        selected_rooms = set(rooms or [])
        with self._lock:
            if not selected_rooms:
                return {
                    "by_type": {k: list(v) for k, v in self._by_type.items()},
                    "latest": dict(self._last_by_entity),
                    "seq": self._seq,
                }

            return {
                "by_type": {
                    k: list(v) for k, v in self._by_type.items() if k in selected_rooms
                },
                "latest": {
                    k: v
                    for k, v in self._last_by_entity.items()
                    if v.get("type") in selected_rooms
                },
                "seq": self._seq,
            }

    def sequence(self) -> int:
        with self._lock:
            return self._seq

    def by_type_counts(self) -> dict[str, int]:
        with self._lock:
            return {
                event_type: len(items) for event_type, items in self._by_type.items()
            }

    @staticmethod
    def _entity_key(event_type: str, event: dict[str, Any]) -> str:
        payload = event.get("payload", {})
        for key in ("movieId", "genre", "tag", "userId", "hour"):
            if key in payload:
                return f"{event_type}:{payload[key]}"
        return f"{event_type}:global"
