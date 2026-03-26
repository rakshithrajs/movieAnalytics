interface HeroStreamProps {
    movieTitle: string;
    score: number;
    avg: number;
    status: string;
}

export function HeroStream({
    movieTitle,
    score,
    avg,
    status,
}: HeroStreamProps) {
    const isConnected = status === "connected";

    return (
        <div className="hero-stream">
            <div className="stream-label">
                {isConnected ? "Currently Streaming" : "Awaiting Connection"}
            </div>
            <h2 className="stream-title">
                {movieTitle.length > 50 ?
                    `${movieTitle.slice(0, 50)}...`
                :   movieTitle}
            </h2>
            <div className="stream-meta">
                <span>
                    Hot Score:{" "}
                    <span className="value">{score.toFixed(2)}</span>
                </span>
                <span>
                    Average: <span className="value">{avg.toFixed(2)}</span>
                </span>
                <span>
                    Status:{" "}
                    <span className="value">
                        {isConnected ? "Active" : "Idle"}
                    </span>
                </span>
            </div>
        </div>
    );
}
