import { create } from "zustand";

import type { AnalyticsEvent } from "../types/events";

const MAX_ITEMS_PER_TYPE = 1000;

interface AnalyticsState {
    status: "idle" | "connecting" | "connected" | "disconnected";
    byType: Record<string, AnalyticsEvent[]>;
    latestByEntity: Record<string, AnalyticsEvent>;
    alerts: AnalyticsEvent[];
    sequence: number;
    setStatus: (status: AnalyticsState["status"]) => void;
    applySnapshot: (state: {
        by_type: Record<string, AnalyticsEvent[]>;
        latest: Record<string, AnalyticsEvent>;
        seq: number;
    }) => void;
    applyPatch: (event: AnalyticsEvent, seq: number) => void;
    pushAlert: (event: AnalyticsEvent, seq: number) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
    status: "idle",
    byType: {},
    latestByEntity: {},
    alerts: [],
    sequence: 0,

    setStatus: (status) => set({ status }),

    applySnapshot: (snapshot) =>
        set({
            byType: snapshot.by_type,
            latestByEntity: snapshot.latest,
            alerts: (snapshot.by_type?.outlier ?? []).slice(-200),
            sequence: snapshot.seq,
        }),

    applyPatch: (event, seq) =>
        set((state) => {
            const typeKey = event.type ?? "unknown";
            const current = state.byType[typeKey] ?? [];
            const updated = [...current, { ...event, seq }].slice(
                -MAX_ITEMS_PER_TYPE,
            );

            const entityKey = resolveEntityKey(event);

            return {
                byType: {
                    ...state.byType,
                    [typeKey]: updated,
                },
                latestByEntity: {
                    ...state.latestByEntity,
                    [entityKey]: event,
                },
                sequence: seq,
            };
        }),

    pushAlert: (event, seq) =>
        set((state) => ({
            alerts: [...state.alerts, { ...event, seq }].slice(-200),
            sequence: Math.max(state.sequence, seq),
        })),
}));

function resolveEntityKey(event: AnalyticsEvent): string {
    const payload = event.payload ?? {};
    const candidates = ["movieId", "genre", "tag", "userId", "hour"];

    for (const key of candidates) {
        if (payload[key] != null) {
            return `${event.type}:${String(payload[key])}`;
        }
    }

    return `${event.type}:global`;
}
