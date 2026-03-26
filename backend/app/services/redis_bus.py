import json
from typing import Any, AsyncIterator

from redis.asyncio import Redis


class RedisBus:
    def __init__(self, redis_url: str, stream_key: str):
        self._redis_url = redis_url
        self._stream_key = stream_key
        self._client: Redis | None = None

    async def connect(self) -> None:
        self._client = Redis.from_url(self._redis_url, decode_responses=True)
        await self._client.ping()

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def publish(self, event: dict[str, Any]) -> str:
        if self._client is None:
            raise RuntimeError("RedisBus is not connected")

        return await self._client.xadd(
            self._stream_key,
            {"event": json.dumps(event)},
            maxlen=100000,
            approximate=True,
        )

    async def consume(
        self, cursor: str = "$", block_ms: int = 100
    ) -> AsyncIterator[dict[str, Any]]:
        if self._client is None:
            raise RuntimeError("RedisBus is not connected")

        last_id = cursor
        while True:
            rows = await self._client.xread(
                {self._stream_key: last_id}, block=block_ms, count=200
            )
            if not rows:
                continue

            for _, events in rows:
                for event_id, payload in events:
                    raw = payload.get("event")
                    if not raw:
                        continue

                    try:
                        event = json.loads(raw)
                    except (TypeError, ValueError, json.JSONDecodeError):
                        continue

                    event["redis_id"] = event_id
                    last_id = event_id
                    yield event
