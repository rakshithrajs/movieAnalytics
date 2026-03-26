import { useEffect, useMemo } from "react";

import { useAnalyticsStore } from "../core/store";
import { AnalyticsWsClient } from "../core/ws-client";
import { OverviewSurface } from "../surfaces/OverviewSurface";

const wsClient = new AnalyticsWsClient();

export function App() {
    const status = useAnalyticsStore((s) => s.status);
    const sequence = useAnalyticsStore((s) => s.sequence);

    useEffect(() => {
        const wsUrl =
            (import.meta.env.VITE_WS_URL as string | undefined) ??
            "ws://localhost:8000/ws/stream";
        wsClient.connect(wsUrl);
        return () => wsClient.disconnect();
    }, []);

    const statusText = useMemo(() => {
        if (status === "connected") return "LIVE";
        if (status === "connecting") return "Connecting...";
        return "Offline";
    }, [status]);

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-title">
                    <h1>CinemaStream Analytics</h1>
                    <span className="subtitle">Real-time movie rating insights</span>
                </div>
                <div className={`status-orb ${status}`}>
                    <span className="dot" />
                    <span>{statusText}</span>
                    <span className="seq">#{sequence.toLocaleString()}</span>
                </div>
            </header>
            <OverviewSurface />
        </div>
    );
}