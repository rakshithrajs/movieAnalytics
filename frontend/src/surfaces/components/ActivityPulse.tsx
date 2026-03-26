interface ActivityPulseProps {
    status: string;
}

export function ActivityPulse({ status }: ActivityPulseProps) {
    const isConnected = status === "connected";

    return (
        <div className="data-panel">
            <div className="activity-pulse">
                <span
                    className={`pulse-dot ${isConnected ? "" : "inactive"}`}
                />
                <span>
                    {isConnected ?
                        "Receiving live data stream"
                    :   "Waiting for connection..."}
                </span>
            </div>
            <div className="data-flow">
                <span>Kafka</span>
                <span className="arrow">→</span>
                <span>Flink</span>
                <span className="arrow">→</span>
                <span>Redis</span>
                <span className="arrow">→</span>
                <span>WebSocket</span>
            </div>
        </div>
    );
}
