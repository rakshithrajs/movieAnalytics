interface RankRow {
    name: string;
    meta?: string;
    score: number;
    change?: number;
}

interface RankListProps {
    title: string;
    rows: RankRow[];
    className?: string;
}

export function RankList({ title, rows, className = "" }: RankListProps) {
    return (
        <section className={`panel ${className}`.trim()}>
            <header className="panel-header">
                <h3>{title}</h3>
            </header>
            <ol className="rank-list">
                {rows.length === 0 && (
                    <li className="rank-row">
                        <span className="rank-pos">-</span>
                        <span className="rank-name-wrap">
                            <span className="rank-name">
                                Waiting for stream data...
                            </span>
                        </span>
                        <span className="rank-score">0.00</span>
                        <span className="rank-change">—</span>
                    </li>
                )}
                {rows.map((row, index) => (
                    <li className="rank-row" key={`${row.name}-${index}`}>
                        <span className="rank-pos">{index + 1}</span>
                        <span className="rank-name-wrap">
                            <span className="rank-name" title={row.name}>
                                {row.name}
                            </span>
                            {row.meta && (
                                <small className="rank-meta">{row.meta}</small>
                            )}
                        </span>
                        <span className="rank-score">
                            {row.score.toFixed(2)}
                        </span>
                        <span
                            className={`rank-change ${row.change && row.change > 0 ? "up" : ""}`}
                        >
                            {row.change ?
                                `${row.change > 0 ? "+" : ""}${row.change.toFixed(2)}`
                            :   "—"}
                        </span>
                    </li>
                ))}
            </ol>
        </section>
    );
}
