from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class EventType(str, Enum):
    movie = "movie"
    genre = "genre"
    tag = "tag"
    user = "user"
    trend = "trend"
    hot = "hot"
    distribution = "distribution"
    global_metric = "global"
    time = "time"
    active_user = "active_user"
    outlier = "outlier"


class Severity(str, Enum):
    normal = "normal"
    elevated = "elevated"
    critical = "critical"


class AnalyticsEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    type: str
    subtype: str = "value"
    payload: Dict[str, Any]
    severity: Severity = Severity.normal


class ConnectionInfo(BaseModel):
    connection_id: str
    ts: datetime
    subscribed_rooms: list[str]


class PatchMessage(BaseModel):
    seq: int
    path: str
    value: Any
    delta: Optional[float] = None


class HeartbeatMessage(BaseModel):
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    kind: str = "HEARTBEAT"


class SnapshotMessage(BaseModel):
    kind: str = "SNAPSHOT"
    seq: int
    state: Dict[str, Any]
