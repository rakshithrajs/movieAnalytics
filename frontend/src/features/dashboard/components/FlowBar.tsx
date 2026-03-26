interface FlowBarDatum {
    label: string;
    value: number;
}

interface FlowBarProps {
    title: string;
    data: FlowBarDatum[];
    className?: string;
}

export function FlowBar({ title, data, className = "" }: FlowBarProps) {
    const max = Math.max(1, ...data.map((d) => d.value));

    return (
        <section className={`panel ${className}`.trim()}>
            <header className="panel-header">
                <h3>{title}</h3>
            </header>
            <div className="flow-bars">
                {data.map((item) => {
                    const width = Math.max(8, (item.value / max) * 100);
                    return (
                        <div key={item.label} className="flow-bar-item">
                            <div className="flow-bar-meta">
                                <span>{item.label}</span>
                                <strong>{item.value.toFixed(2)}</strong>
                            </div>
                            <div className="flow-bar-track">
                                <div
                                    className="flow-bar-fill"
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
