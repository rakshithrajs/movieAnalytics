interface Metric {
    label: string;
    value: string;
    highlight?: boolean;
}

interface MetricsStripProps {
    metrics: Metric[];
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
    return (
        <div className="metrics-strip">
            {metrics.map((metric) => (
                <div
                    key={metric.label}
                    className={`metric-tile ${metric.highlight ? "highlight" : ""}`}
                >
                    <div className="label">{metric.label}</div>
                    <div className="value">{metric.value}</div>
                </div>
            ))}
        </div>
    );
}
