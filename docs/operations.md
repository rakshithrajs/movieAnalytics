# Local Runbook

## Prerequisites

- Python 3.10+
- Node.js 20+
- Redis 7+
- Kafka + Zookeeper
- Existing Flink + producer scripts in `scripts/`

## Backend

1. Create virtual environment and install dependencies.
2. Copy `backend/.env.example` to `backend/.env`.
3. Run `uvicorn app.main:app --reload` from `backend/`.

## Frontend

1. From `frontend/`: `npm install`
2. Copy `.env.example` to `.env`
3. Run `npm run dev`

## Data stream

- Start Kafka broker/topic (`movie_ratings`).
- Run producer: `python scripts/kafka_producer.py`
- Run Flink analytics: `python scripts/flink_kafka_stream.py`
- Ensure Flink output is bridged to Redis stream `analytics:stream`.

## Health checks

- Backend health: `GET /health`
- Snapshot: `GET /snapshot`
- WebSocket: connect to `/ws/stream`

## Dashboard checks (new analytics)

- Confirm **Best Genre by Year** panel populates with `year_best_genre` events.
- Confirm **Top Years (Average Rating)** panel populates with `year_avg` events.
- Confirm **Most Active Year** metric changes when `year_activity` events arrive.
