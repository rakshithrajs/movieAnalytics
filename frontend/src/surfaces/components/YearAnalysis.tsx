interface YearData {
    year: number;
    avg: number;
    count: number;
    bestGenre: string;
}

interface YearAnalysisProps {
    data: YearData[];
}

export function YearAnalysis({ data }: YearAnalysisProps) {
    if (data.length === 0) {
        return <div className="empty-state">No year data yet...</div>;
    }

    return (
        <div className="year-grid">
            {data.slice(0, 6).map((item, index) => (
                <div key={item.year} className="year-card">
                    <div className="year-label">{item.year}</div>
                    <div className="year-value">
                        {item.bestGenre ?
                            `Best: ${item.bestGenre}`
                        :   "No genre data"}
                    </div>
                    <div className="year-avg">
                        Avg: {item.avg.toFixed(2)} ·{" "}
                        {item.count.toLocaleString()} ratings
                    </div>
                </div>
            ))}
        </div>
    );
}
