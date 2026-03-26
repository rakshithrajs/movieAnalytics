#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

is_redis_up() {
  python - <<'PY'
import socket
s = socket.socket()
s.settimeout(0.5)
try:
    s.connect(("127.0.0.1", 6379))
    print("up")
except Exception:
    print("down")
finally:
    s.close()
PY
}

wait_backend_ready() {
  python - <<'PY'
import time
import urllib.request

url = "http://127.0.0.1:8000/health"
deadline = time.time() + 20
while time.time() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=1) as r:
            if r.status == 200:
                print("backend-ready")
                raise SystemExit(0)
    except Exception:
        time.sleep(0.5)

print("backend-not-ready")
raise SystemExit(1)
PY
}

echo "[1/5] Starting backend dependencies check"
if [[ "$(is_redis_up)" == "up" ]]; then
  echo "Redis reachable on localhost:6379"
else
  echo "Redis not reachable on localhost:6379"
  if command -v docker >/dev/null 2>&1; then
    echo "Starting Redis via Docker container: bigdata-redis"
    docker rm -f bigdata-redis >/dev/null 2>&1 || true
    docker run -d --name bigdata-redis -p 6379:6379 redis:7-alpine >/dev/null
    sleep 2
    if [[ "$(is_redis_up)" == "up" ]]; then
      echo "Redis started via Docker"
    else
      echo "Error: Redis still not reachable after Docker start"
      exit 1
    fi
  else
    echo "Error: Redis is required but not running, and Docker is not available"
    exit 1
  fi
fi

echo "[2/5] Starting FastAPI backend"
(
  cd "$ROOT_DIR/backend"
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

wait_backend_ready

echo "[3/5] Starting frontend"
(
  cd "$ROOT_DIR/frontend"
  npm run dev -- --host 0.0.0.0 --port 5173
) &
FRONTEND_PID=$!

echo "[4/5] Run Kafka producer and Flink stream in separate terminals"
echo "    python scripts/kafka_producer.py"
echo "    python scripts/flink_kafka_stream.py"

echo "[5/5] Dashboard available at http://localhost:5173"

echo "Press Ctrl+C to stop..."
trap 'kill ${BACKEND_PID} ${FRONTEND_PID} 2>/dev/null || true' INT TERM
wait
