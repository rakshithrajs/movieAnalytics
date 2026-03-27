#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

KAFKA_HOME="/home/raj/confluent-7.0.0"
ZOOKEEPER_CONFIG="$KAFKA_HOME/etc/kafka/zookeeper.properties"
KAFKA_CONFIG="$KAFKA_HOME/etc/kafka/server.properties"

ZOOKEEPER_PID=""
KAFKA_PID=""
PRODUCER_PID=""
FLINK_PID=""

wait_port_ready() {
  local host="$1"
  local port="$2"
  local timeout_seconds="$3"
  python - "$host" "$port" "$timeout_seconds" <<'PY'
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
timeout = float(sys.argv[3])
deadline = time.time() + timeout

while time.time() < deadline:
    s = socket.socket()
    s.settimeout(0.5)
    try:
        s.connect((host, port))
        print("ready")
        raise SystemExit(0)
    except Exception:
        time.sleep(0.25)
    finally:
        s.close()

print("not-ready")
raise SystemExit(1)
PY
}

start_stream_infra() {
  echo "[0/6] Starting Zookeeper and Kafka services"

  if [[ ! -f "$ZOOKEEPER_CONFIG" ]]; then
    echo "Error: Zookeeper config not found: $ZOOKEEPER_CONFIG"
    exit 1
  fi

  if [[ ! -f "$KAFKA_CONFIG" ]]; then
    echo "Error: Kafka config not found: $KAFKA_CONFIG"
    exit 1
  fi

  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 2181 >/dev/null 2>&1; then
    echo "Zookeeper already reachable on localhost:2181"
  else
    zookeeper-server-start "$ZOOKEEPER_CONFIG" >/tmp/bigdata-zookeeper.log 2>&1 &
    ZOOKEEPER_PID=$!

    if ! wait_port_ready 127.0.0.1 2181 20 >/dev/null; then
      echo "Error: Zookeeper failed to start. See /tmp/bigdata-zookeeper.log"
      exit 1
    fi
    echo "Zookeeper started"
  fi

  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 9092 >/dev/null 2>&1; then
    echo "Kafka already reachable on localhost:9092"
  else
    kafka-server-start "$KAFKA_CONFIG" >/tmp/bigdata-kafka.log 2>&1 &
    KAFKA_PID=$!

    if ! wait_port_ready 127.0.0.1 9092 25 >/dev/null; then
      echo "Error: Kafka failed to start. See /tmp/bigdata-kafka.log"
      exit 1
    fi
    echo "Kafka started"
  fi
}

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

start_stream_infra

echo "[1/6] Starting backend dependencies check"
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

echo "[2/6] Starting FastAPI backend"
(
  cd "$ROOT_DIR/backend"
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

wait_backend_ready

echo "[3/6] Starting frontend"
(
  cd "$ROOT_DIR/frontend"
  npm run dev -- --host 0.0.0.0 --port 5173
) &
FRONTEND_PID=$!

echo "[4/6] Starting Kafka producer and Flink stream"
(
  cd "$ROOT_DIR"
  python scripts/kafka_producer.py
) >/tmp/bigdata-producer.log 2>&1 &
PRODUCER_PID=$!

(
  cd "$ROOT_DIR"
  python scripts/flink_kafka_stream.py
) >/tmp/bigdata-flink.log 2>&1 &
FLINK_PID=$!

sleep 2
if ! kill -0 "$PRODUCER_PID" 2>/dev/null; then
  echo "Error: Kafka producer exited early. See /tmp/bigdata-producer.log"
  exit 1
fi
if ! kill -0 "$FLINK_PID" 2>/dev/null; then
  echo "Error: Flink stream exited early. See /tmp/bigdata-flink.log"
  exit 1
fi

echo "[5/6] Dashboard available at http://localhost:5173"
echo "[6/6] Streaming infra and app stack are up"
echo "Logs:"
echo "  /tmp/bigdata-zookeeper.log"
echo "  /tmp/bigdata-kafka.log"
echo "  /tmp/bigdata-producer.log"
echo "  /tmp/bigdata-flink.log"

echo "Press Ctrl+C to stop..."
trap 'kill ${BACKEND_PID:-} ${FRONTEND_PID:-} ${PRODUCER_PID:-} ${FLINK_PID:-} ${KAFKA_PID:-} ${ZOOKEEPER_PID:-} 2>/dev/null || true' INT TERM
wait
