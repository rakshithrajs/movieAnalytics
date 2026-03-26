import type { AnalyticsEvent } from "../../types/events";

interface GenreCardsProps {
    genres: AnalyticsEvent[];
}

export function GenreCards({ genres }: GenreCardsProps) {
    const maxAvg = Math.max(
        1,
        ...genres.map((g) => Number(g.payload?.avg ?? 0)),
    );

    if (genres.length === 0) {
        return <div className="empty-state">No genre data yet...</div>;
    }

    return (
        <div className="genre-grid">
            {genres.map((item, index) => {
                const genre = String(item.payload?.genre ?? "Unknown");
                const avg = Number(item.payload?.avg ?? 0);
                const count = Number(item.payload?.count ?? 0);
                const fillWidth = (avg / maxAvg) * 100;

                return (
                    <div key={genre} className="genre-card">
                        <div className="genre-name" title={genre}>
                            {genre}
                        </div>
                        <div className="genre-score">{avg.toFixed(2)}</div>
                        <div className="genre-bar">
                            <div
                                className="genre-bar-fill"
                                style={{ width: `${fillWidth}%` }}
                            />
                        </div>
                        <div className="genre-meta">
                            {count.toLocaleString()} ratings
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
