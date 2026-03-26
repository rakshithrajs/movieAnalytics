export type EventSeverity = "normal" | "elevated" | "critical";

export interface AnalyticsEvent {
    id: string;
    ts: string;
    type: string;
    subtype: string;
    payload: Record<string, unknown>;
    severity: EventSeverity;
    seq?: number;
}

export interface WsPatchMessage {
    kind: "PATCH";
    seq: number;
    room: string;
    event: AnalyticsEvent;
    ts: string;
}

export interface WsAlertMessage {
    kind: "ALERT";
    seq: number;
    severity: EventSeverity;
    event: AnalyticsEvent;
    ts: string;
}

export interface WsSnapshotMessage {
    kind: "SNAPSHOT";
    seq: number;
    state: {
        by_type: Record<string, AnalyticsEvent[]>;
        latest: Record<string, AnalyticsEvent>;
        seq: number;
    };
}

export interface MetricCardModel {
    label: string;
    value: string;
    delta?: string;
    emphasis?: "normal" | "highlight";
}

export interface AlertRowModel {
    severity: EventSeverity;
    title: string;
    detail: string;
    ts: string;
}
