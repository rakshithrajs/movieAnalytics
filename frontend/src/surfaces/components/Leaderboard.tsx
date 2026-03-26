interface LeaderboardRow {
    movieId: string;
    title: string;
    score: number;
    avg: number;
}

interface LeaderboardProps {
    rows: LeaderboardRow[];
}

export function Leaderboard({ rows }: LeaderboardProps) {
    if (rows.length === 0) {
        return (
            <div className="data-panel">
                <div className="empty-state">
                    <div className="icon">📊</div>
                    Waiting for movie data...
                </div>
            </div>
        );
    }

    return (
        <div className="data-panel">
            <div className="leaderboard">
                {rows.map((row, index) => (
                    <div key={row.movieId} className="leaderboard-row">
                        <span className={`rank ${index < 3 ? "top-3" : ""}`}>
                            {index + 1}
                        </span>
                        <div className="movie-info">
                            <span className="movie-title" title={row.title}>
                                {row.title}
                            </span>
                            <span className="movie-id">ID: {row.movieId}</span>
                        </div>
                        <span className="movie-score">
                            {row.score.toFixed(1)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
