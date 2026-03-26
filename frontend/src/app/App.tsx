import { useEffect, useMemo } from "react";

import { useAnalyticsStore } from "../core/store";
import { tokens } from "../core/theme/tokens";
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
        if (status === "connected") return "Live";
        if (status === "connecting") return "Connecting";
        return "Offline";
    }, [status]);

    return (
        <main
            className="app-shell"
            style={{ fontFamily: tokens.typography.body }}
        >
            <header className="top-bar">
                <div>
                    <h1>Real-Time Movie Analytics</h1>
                    <p>
                        Live view of top movies, genre performance, and notable
                        rating changes.
                    </p>
                </div>

                <div className="status-block">
                    <span className={`status-dot status-${status}`} />
                    <span>{statusText}</span>
                    <code>seq {sequence}</code>
                </div>
            </header>

            <OverviewSurface />
        </main>
    );
}
