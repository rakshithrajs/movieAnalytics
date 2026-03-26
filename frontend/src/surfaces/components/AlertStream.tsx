import type { AnalyticsEvent } from "../../types/events";

interface AlertStreamProps {
    alerts: AnalyticsEvent[];
}

export function AlertStream({ alerts }: AlertStreamProps) {
    if (alerts.length === 0) {
        return (
            <div className="empty-state">
                <div style={{ opacity: 0.5 }}>No alerts. System stable.</div>
            </div>
        );
    }

    const movieLabel = (payload: Record<string, unknown> | undefined) => {
        const title = String(payload?.movieTitle ?? "").trim();
        if (!title || title.toLowerCase() === "unknown movie") {
            return `Movie #${payload?.movieId ?? "-"}`;
        }
        return title.length > 40 ? `${title.slice(0, 40)}...` : title;
    };

    return (
        <div className="alert-stream">
            {alerts.map((alert, index) => {
                const payload = alert.payload ?? {};
                const severity =
                    alert.severity === "critical" ? "critical"
                    : alert.severity === "elevated" ? "elevated"
                    : "normal";

                const movieTitle = movieLabel(payload);
                const detail =
                    alert.type === "outlier" ?
                        `${movieTitle} deviated from average (diff: ${payload.diff ?? 0})`
                    :   `${movieTitle} trend shift detected`;

                return (
                    <div
                        key={`${alert.id}-${index}`}
                        className={`alert-item severity-${severity}`}
                    >
                        <div className="alert-title">
                            {alert.type.toUpperCase()}
                        </div>
                        <div className="alert-detail">{detail}</div>
                        <div className="alert-time">
                            {new Date(alert.ts).toLocaleTimeString()}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
