import json
import math
import os
from datetime import timezone
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from pyflink.common import Time, WatermarkStrategy
from pyflink.common.serialization import SimpleStringSchema
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaSource
from pyflink.datastream.window import TumblingProcessingTimeWindows


# --- Configuration ---
BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_TOPIC = "movie_ratings"
KAFKA_GROUP_ID = "flink_group"
WINDOW_SECONDS = int(os.getenv("WINDOW_SECONDS", "3"))
OUTLIER_THRESHOLD = 1.5
JOB_NAME = "Advanced Movie Analytics Streaming Job"
ENABLE_REDIS_SINK = os.getenv("ENABLE_REDIS_SINK", "1") == "1"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_STREAM_KEY = os.getenv("REDIS_STREAM_KEY", "analytics:stream")

FLINK_JARS = [
    "file:///home/raj/BigData/flink_jars/flink-connector-kafka-1.17.2.jar",
    "file:///home/raj/BigData/flink_jars/kafka-clients-3.4.0.jar",
]


RatingTuple = Tuple[Any, float, int]
MovieTuple = Tuple[Any, str, float, int]


def build_event_envelope(record: Dict[str, Any]) -> Dict[str, Any]:
    event_type = str(record.get("type", "unknown"))
    subtype = "value"
    severity = "normal"

    if event_type == "trend":
        subtype = "rank_change"
        trend = abs(float(record.get("trend", 0)))
        if trend >= 1.0:
            severity = "critical"
        elif trend >= 0.5:
            severity = "elevated"
    elif event_type == "outlier":
        subtype = "anomaly"
        diff = float(record.get("diff", 0))
        if diff >= 2.0:
            severity = "critical"
        elif diff >= 1.5:
            severity = "elevated"
    elif event_type == "hot":
        subtype = "velocity"
        score = float(record.get("score", 0))
        if score >= 12:
            severity = "elevated"

    return {
        "id": str(uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "type": event_type,
        "subtype": subtype,
        "payload": record,
        "severity": severity,
    }


def build_redis_sink_mapper():
    try:
        import redis  # noqa: F401
    except Exception:
        return None

    redis_client = None

    def publish(record: Dict[str, Any]) -> Dict[str, Any]:
        nonlocal redis_client
        if redis_client is None:
            from redis import Redis

            redis_client = Redis.from_url(REDIS_URL, decode_responses=True)

        event = build_event_envelope(record)
        try:
            redis_client.xadd(
                REDIS_STREAM_KEY,
                {"event": json.dumps(event)},
                maxlen=100000,
                approximate=True,
            )
        except Exception:
            # Keep stream processing alive even if Redis is temporarily unavailable.
            pass
        return record

    return publish


def parse_data(value: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return None


def build_trending_mapper():
    prev_avg = {}

    def map_trending(value: Dict[str, Any]) -> Dict[str, Any]:
        movie_id = value["movieId"]
        movie_title = value.get("movieTitle", "Unknown Movie")
        current_avg = value["avg"]

        previous_avg = prev_avg.get(movie_id, current_avg)
        trend = round(current_avg - previous_avg, 2)
        prev_avg[movie_id] = current_avg

        return {
            "type": "trend",
            "movieId": movie_id,
            "movieTitle": movie_title,
            "trend": trend,
            "current_avg": current_avg,
        }

    return map_trending


def create_environment() -> StreamExecutionEnvironment:
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(1)
    env.add_jars(*FLINK_JARS)
    return env


def create_source() -> KafkaSource:
    return (
        KafkaSource.builder()
        .set_bootstrap_servers(BOOTSTRAP_SERVERS)
        .set_topics(KAFKA_TOPIC)
        .set_group_id(KAFKA_GROUP_ID)
        .set_value_only_deserializer(SimpleStringSchema())
        .build()
    )


def windowed_sum(left: RatingTuple, right: RatingTuple) -> RatingTuple:
    return left[0], left[1] + right[1], left[2] + right[2]


def map_movie(record: Dict[str, Any]) -> MovieTuple:
    return (
        record["movieId"],
        record.get("movieTitle", "Unknown Movie"),
        record["rating"],
        1,
    )


def reduce_movie(left: MovieTuple, right: MovieTuple) -> MovieTuple:
    movie_id = left[0]
    movie_title = left[1] or right[1]
    total = left[2] + right[2]
    count = left[3] + right[3]
    return movie_id, movie_title, total, count


def compute_movie(value: MovieTuple) -> Dict[str, Any]:
    movie_id, movie_title, total, count = value
    avg = total / count
    weighted = (avg * count) / (count + 10)
    return {
        "type": "movie",
        "movieId": movie_id,
        "movieTitle": movie_title,
        "avg": round(avg, 2),
        "count": count,
        "weighted": round(weighted, 2),
    }


def explode_genres(record: Dict[str, Any]) -> List[RatingTuple]:
    return [(genre, record["rating"], 1) for genre in record.get("genres", [])]


def to_genre_result(value: RatingTuple) -> Dict[str, Any]:
    return {
        "type": "genre",
        "genre": value[0],
        "avg": round(value[1] / value[2], 2),
        "count": value[2],
    }


def explode_tags(record: Dict[str, Any]) -> List[RatingTuple]:
    return [(tag, record["rating"], 1) for tag in record.get("tags", [])]


def to_tag_result(value: RatingTuple) -> Dict[str, Any]:
    return {
        "type": "tag",
        "tag": value[0],
        "avg": round(value[1] / value[2], 2),
        "count": value[2],
    }


def map_global(record: Dict[str, Any]) -> RatingTuple:
    return "global", record["rating"], 1


def reduce_global(left: RatingTuple, right: RatingTuple) -> RatingTuple:
    return "global", left[1] + right[1], left[2] + right[2]


def to_global_result(value: RatingTuple) -> Dict[str, Any]:
    return {"type": "global", "avg": round(value[1] / value[2], 2), "count": value[2]}


def map_user(record: Dict[str, Any]) -> RatingTuple:
    return record["userId"], record["rating"], 1


def to_user_result(value: RatingTuple) -> Dict[str, Any]:
    return {
        "type": "user",
        "userId": value[0],
        "avg_rating": round(value[1] / value[2], 2),
        "count": value[2],
    }


def map_time(record: Dict[str, Any]) -> RatingTuple:
    hour = datetime.fromtimestamp(record["timestamp"]).hour
    return hour, record["rating"], 1


def to_time_result(value: RatingTuple) -> Dict[str, Any]:
    return {
        "type": "time",
        "hour": value[0],
        "avg_rating": round(value[1] / value[2], 2),
        "count": value[2],
    }


def map_year(record: Dict[str, Any]) -> RatingTuple:
    year = datetime.fromtimestamp(record["timestamp"]).year
    return year, record["rating"], 1


def to_year_avg_result(value: RatingTuple) -> Dict[str, Any]:
    return {
        "type": "year_avg",
        "year": value[0],
        "avg_rating": round(value[1] / value[2], 2),
        "count": value[2],
    }


def map_year_activity(record: Dict[str, Any]) -> Tuple[int, int]:
    year = datetime.fromtimestamp(record["timestamp"]).year
    return year, 1


def reduce_year_activity(
    left: Tuple[int, int], right: Tuple[int, int]
) -> Tuple[int, int]:
    return left[0], left[1] + right[1]


def to_year_activity_result(value: Tuple[int, int]) -> Dict[str, Any]:
    return {
        "type": "year_activity",
        "year": value[0],
        "count": value[1],
    }


def explode_year_genres(record: Dict[str, Any]) -> List[Tuple[int, str, float, int]]:
    year = datetime.fromtimestamp(record["timestamp"]).year
    return [
        (year, genre, record["rating"], 1)
        for genre in record.get("genres", [])
        if genre
    ]


def reduce_year_genre(
    left: Tuple[int, str, float, int], right: Tuple[int, str, float, int]
) -> Tuple[int, str, float, int]:
    return left[0], left[1], left[2] + right[2], left[3] + right[3]


def map_year_best_candidate(
    value: Tuple[int, str, float, int],
) -> Tuple[int, str, float, int]:
    year, genre, total, count = value
    avg = total / count
    return year, genre, avg, count


def reduce_year_best(
    left: Tuple[int, str, float, int], right: Tuple[int, str, float, int]
) -> Tuple[int, str, float, int]:
    # Prefer higher average rating; tie-break with higher sample size.
    if right[2] > left[2]:
        return right
    if right[2] == left[2] and right[3] > left[3]:
        return right
    return left


def to_year_best_genre_result(value: Tuple[int, str, float, int]) -> Dict[str, Any]:
    return {
        "type": "year_best_genre",
        "year": value[0],
        "genre": value[1],
        "avg_rating": round(value[2], 2),
        "count": value[3],
    }


def map_distribution(record: Dict[str, Any]) -> Tuple[Any, str, List[int]]:
    rating_int = int(round(record["rating"]))
    clamped_rating = min(5, max(1, rating_int))
    return (
        record["movieId"],
        record.get("movieTitle", "Unknown Movie"),
        [1 if i == clamped_rating else 0 for i in range(1, 6)],
    )


def reduce_distribution(
    left: Tuple[Any, str, List[int]], right: Tuple[Any, str, List[int]]
) -> Tuple[Any, str, List[int]]:
    movie_id = left[0]
    movie_title = left[1] or right[1]
    distribution = [a + b for a, b in zip(left[2], right[2])]
    return movie_id, movie_title, distribution


def to_distribution_result(value: Tuple[Any, str, List[int]]) -> Dict[str, Any]:
    return {
        "type": "distribution",
        "movieId": value[0],
        "movieTitle": value[1],
        "dist": {
            "1": value[2][0],
            "2": value[2][1],
            "3": value[2][2],
            "4": value[2][3],
            "5": value[2][4],
        },
    }


def map_active_user(record: Dict[str, Any]) -> Tuple[Any, int]:
    return record["userId"], 1


def reduce_active_user(
    left: Tuple[Any, int], right: Tuple[Any, int]
) -> Tuple[Any, int]:
    return left[0], left[1] + right[1]


def to_active_user_result(value: Tuple[Any, int]) -> Dict[str, Any]:
    return {"type": "active_user", "userId": value[0], "activity": value[1]}


def compute_hot(value: Dict[str, Any]) -> Dict[str, Any]:
    movie_id = value["movieId"]
    movie_title = value.get("movieTitle", "Unknown Movie")
    avg = value["avg"]
    count = value["count"]
    score = avg * math.log(count + 1)
    return {
        "type": "hot",
        "movieId": movie_id,
        "movieTitle": movie_title,
        "score": round(score, 2),
        "avg": avg,
        "count": count,
    }


def build_pipeline() -> None:
    env = create_environment()
    source = create_source()

    raw_stream = env.from_source(
        source,
        WatermarkStrategy.no_watermarks(),
        "Kafka Source",
    )

    parsed = raw_stream.map(parse_data).filter(lambda x: x is not None)
    window = TumblingProcessingTimeWindows.of(Time.seconds(WINDOW_SECONDS))

    movie_stream = (
        parsed.map(map_movie)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(reduce_movie)
        .map(compute_movie)
    )

    genre_stream = (
        parsed.flat_map(explode_genres)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(windowed_sum)
        .map(to_genre_result)
    )

    tag_stream = (
        parsed.flat_map(explode_tags)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(windowed_sum)
        .map(to_tag_result)
    )

    global_stream = (
        parsed.map(map_global)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(reduce_global)
        .map(to_global_result)
    )

    user_stream = (
        parsed.map(map_user)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(windowed_sum)
        .map(to_user_result)
    )

    time_stream = (
        parsed.map(map_time)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(windowed_sum)
        .map(to_time_result)
    )

    year_avg_stream = (
        parsed.map(map_year)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(windowed_sum)
        .map(to_year_avg_result)
    )

    year_activity_stream = (
        parsed.map(map_year_activity)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(reduce_year_activity)
        .map(to_year_activity_result)
    )

    year_best_genre_stream = (
        parsed.flat_map(explode_year_genres)
        .key_by(lambda x: f"{x[0]}::{x[1]}")
        .window(window)
        .reduce(reduce_year_genre)
        .map(map_year_best_candidate)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(reduce_year_best)
        .map(to_year_best_genre_result)
    )

    trend_stream = movie_stream.map(build_trending_mapper())

    distribution_stream = (
        parsed.map(map_distribution)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(reduce_distribution)
        .map(to_distribution_result)
    )

    active_user_stream = (
        parsed.map(map_active_user)
        .key_by(lambda x: x[0])
        .window(window)
        .reduce(reduce_active_user)
        .map(to_active_user_result)
    )

    hot_stream = movie_stream.map(compute_hot)

    # Keep behavior aligned with original implementation:
    # global average is maintained in-process and used to detect outliers.
    global_avg_state = {"avg": 0.0}

    def capture_global(record: Dict[str, Any]) -> Dict[str, Any]:
        global_avg_state["avg"] = record["avg"]
        return record

    global_stream = global_stream.map(capture_global)

    def detect_outlier(record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        global_avg = global_avg_state.get("avg", 0.0)
        if global_avg == 0:
            return None

        diff = abs(record["avg"] - global_avg)
        if diff > OUTLIER_THRESHOLD:
            return {
                "type": "outlier",
                "movieId": record["movieId"],
                "movieTitle": record.get("movieTitle", "Unknown Movie"),
                "avg": record["avg"],
                "global_avg": global_avg,
                "diff": round(diff, 2),
            }
        return None

    outlier_stream = movie_stream.map(detect_outlier).filter(lambda x: x is not None)

    if ENABLE_REDIS_SINK:
        redis_sink = build_redis_sink_mapper()
        if redis_sink is not None:
            combined_stream = movie_stream.union(
                genre_stream,
                tag_stream,
                global_stream,
                user_stream,
                time_stream,
                year_avg_stream,
                year_activity_stream,
                year_best_genre_stream,
                trend_stream,
                distribution_stream,
                active_user_stream,
                hot_stream,
                outlier_stream,
            ).map(redis_sink)
            # Attach a sink without noisy console output.
            combined_stream.filter(lambda _: False).print()
        else:
            movie_stream.print()
    else:
        movie_stream.print()

    # movie_stream.print()
    genre_stream.print()
    # tag_stream.print()
    # global_stream.print()
    # user_stream.print()
    # time_stream.print()
    # year_avg_stream.print()
    # year_activity_stream.print()
    # year_best_genre_stream.print()
    # trend_stream.print()
    # distribution_stream.print()
    # active_user_stream.print()
    # hot_stream.print()
    # outlier_stream.print()

    env.execute(JOB_NAME)


if __name__ == "__main__":
    build_pipeline()
