interface TrendLineProps {
    title: string;
    points: number[];
    className?: string;
}

export function TrendLine({ title, points, className = "" }: TrendLineProps) {
    const safePoints = points.length > 1 ? points : [0, ...points, 0];
    const max = Math.max(...safePoints, 1);
    const min = Math.min(...safePoints, 0);
    const width = 420;
    const height = 140;

    const scaleX = (index: number) =>
        (index / (safePoints.length - 1)) * width;
    const scaleY = (value: number) => {
        if (max === min) return height / 2;
        return height - ((value - min) / (max - min)) * height;
    };

    const line = safePoints
        .map(
            (v, i) =>
                `${i === 0 ? "M" : "L"} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`,
        )
        .join(" ");

    const area = `${line} L ${width} ${height} L 0 ${height} Z`;

    return (
        <section className={`panel ${className}`.trim()}>
            <header className="panel-header">
                <h3>{title}</h3>
            </header>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="trend-svg"
                role="img"
                aria-label={title}
            >
                <path d={area} className="trend-area" />
                <path d={line} className="trend-line" />
            </svg>
        </section>
    );
}
