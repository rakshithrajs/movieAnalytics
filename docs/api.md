# API and WebSocket Spec

## REST

### `GET /health`

Returns service status and latest sequence.

### `GET /snapshot?rooms=movie,genre,hot`

Returns a full current state snapshot for selected rooms.

Example with year analytics:

`GET /snapshot?rooms=year_best_genre,year_avg,year_activity`

### `GET /metrics`

Returns runtime counters (`connections`, `room_counts`, `by_type_counts`, `sequence`).

## WebSocket

### Endpoint

`/ws/stream`

### Client Messages

- `{"action":"subscribe","rooms":["movie","genre"]}`
- `{"action":"unsubscribe","rooms":["genre"]}`
- `{"action":"snapshot","rooms":["hot"]}`
- `{"action":"heartbeat","ts":"..."}`

Room names currently published:

- `movie`
- `genre`
- `tag`
- `user`
- `trend`
- `hot`
- `distribution`
- `global`
- `time`
- `active_user`
- `outlier`
- `year_avg`
- `year_activity`
- `year_best_genre`
- `alerts` (special alert room)

### Server Messages

- `CONNECTED`: connection metadata
- `SNAPSHOT`: complete in-memory state
- `PATCH`: incremental update by room/type
- `ALERT`: elevated/critical event notification for the `alerts` room
- `SUBSCRIBED` / `UNSUBSCRIBED`: room acknowledgement
- `HEARTBEAT` / `HEARTBEAT_ACK`: liveness protocol

## New Year-based event payloads

### `year_best_genre`

```json
{
  "type": "year_best_genre",
  "payload": {
    "year": 2001,
    "genre": "Documentary",
    "avg_rating": 4.52,
    "count": 121
  }
}
```

### `year_avg`

```json
{
  "type": "year_avg",
  "payload": {
    "year": 2001,
    "avg_rating": 3.71,
    "count": 842
  }
}
```

### `year_activity`

```json
{
  "type": "year_activity",
  "payload": {
    "year": 2001,
    "count": 842
  }
}
```
