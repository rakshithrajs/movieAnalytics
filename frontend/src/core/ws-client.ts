import { useAnalyticsStore } from "./store";
import type {
    AnalyticsEvent,
    WsAlertMessage,
    WsPatchMessage,
    WsSnapshotMessage,
} from "../types/events";

const ROOM_TYPES = [
    "movie",
    "genre",
    "tag",
    "user",
    "trend",
    "hot",
    "distribution",
    "global",
    "time",
    "active_user",
    "outlier",
    "year_avg",
    "year_activity",
    "year_best_genre",
    "alerts",
];

export class AnalyticsWsClient {
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private reconnectTimer: number | null = null;

    connect(url: string): void {
        useAnalyticsStore.getState().setStatus("connecting");
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            this.reconnectAttempts = 0;
            useAnalyticsStore.getState().setStatus("connected");
            this.send({ action: "subscribe", rooms: ROOM_TYPES });
            this.send({ action: "snapshot", rooms: ROOM_TYPES });
        };

        this.socket.onmessage = (messageEvent) => {
            this.handleMessage(messageEvent.data);
        };

        this.socket.onclose = () => {
            useAnalyticsStore.getState().setStatus("disconnected");
            this.scheduleReconnect(url);
        };

        this.socket.onerror = () => {
            useAnalyticsStore.getState().setStatus("disconnected");
        };
    }

    disconnect(): void {
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
        }

        if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
            this.socket.close();
        }

        this.socket = null;
        useAnalyticsStore.getState().setStatus("disconnected");
    }

    private send(payload: unknown): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        this.socket.send(JSON.stringify(payload));
    }

    private handleMessage(raw: string): void {
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        if (typeof parsed !== "object" || parsed == null) {
            return;
        }

        const kind = (parsed as { kind?: string }).kind;

        if (kind === "SNAPSHOT") {
            const snapshot = parsed as WsSnapshotMessage;
            if (snapshot.state) {
                useAnalyticsStore.getState().applySnapshot(snapshot.state);
            }
            return;
        }

        if (kind === "PATCH") {
            const patch = parsed as WsPatchMessage;
            if (patch.event) {
                useAnalyticsStore
                    .getState()
                    .applyPatch(patch.event as AnalyticsEvent, patch.seq);
            }
            return;
        }

        if (kind === "ALERT") {
            const alert = parsed as WsAlertMessage;
            if (alert.event) {
                useAnalyticsStore
                    .getState()
                    .pushAlert(alert.event as AnalyticsEvent, alert.seq);
            }
        }
    }

    private scheduleReconnect(url: string): void {
        const baseDelay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
        const jitter = Math.round(Math.random() * 250);
        this.reconnectAttempts += 1;

        this.reconnectTimer = window.setTimeout(() => {
            this.connect(url);
        }, baseDelay + jitter);
    }
}
