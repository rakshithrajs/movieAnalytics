# Real-Time Movie Analytics Architecture

## Pipeline

1. **Producer** reads MovieLens CSV and publishes enriched records to Kafka topic `movie_ratings`.
2. **Flink** computes parallel analytics windows (`movie`, `genre`, `tag`, `user`, `trend`, `hot`, `year_avg`, `year_activity`, `year_best_genre`, etc.).
3. **Redis Stream** acts as low-latency buffer (`analytics:stream`) for frontend delivery.
4. **FastAPI** consumes Redis events, maintains in-memory cache, and broadcasts websocket patches.
5. **React Dashboard** hydrates with snapshot and applies patches in real time.

## Backend Components

- `backend/app/main.py`: REST + WebSocket API entrypoint
- `backend/app/services/redis_bus.py`: Redis Stream read/write abstraction
- `backend/app/services/aggregates.py`: bounded in-memory cache (latest by type/entity)
- `backend/app/ws/manager.py`: room-based WebSocket fan-out

## Frontend Components

- `frontend/src/core/ws-client.ts`: resilient websocket transport (reconnect/backoff)
- `frontend/src/core/store.ts`: Zustand state with snapshot/patch reducers
- `frontend/src/surfaces/OverviewSurface.tsx`: first executive dashboard surface
- `frontend/src/viz/*`: custom data visuals (FlowBar, TrendLine, RankList, MetricCard)

## Key Design Choices

- **Editorial dark palette** for high readability and low visual noise.
- **Diff-driven updates** (`PATCH`) to keep render cost predictable.
- **Snapshot + subscribe protocol** for reliable reconnection.
- **Strict schema contract** in `contracts/event-schema.json` for interoperability.

## Additional Year-focused Insights

- **Best genre by year** is derived from per-year/per-genre average ratings.
- **Year average rating** tracks quality trend across historical years.
- **Year activity** tracks rating volume concentration across years.
