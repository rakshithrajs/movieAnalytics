import type { AlertRowModel } from "../../../types/events";

interface AlertFeedProps {
    title: string;
    rows: AlertRowModel[];
}

export function AlertFeed({ title, rows }: AlertFeedProps) {
    return (
        <section className="panel panel-alerts">
            <header className="panel-header">
                <h3>{title}</h3>
            </header>

            <ul className="alert-list">
                {rows.length === 0 && (
                    <li className="alert-row alert-empty">
                        No elevated events yet.
                    </li>
                )}

                {rows.map((row, index) => (
                    <li
                        key={`${row.ts}-${index}`}
                        className={`alert-row severity-${row.severity}`}
                    >
                        <div className="alert-header">
                            <strong>{row.title}</strong>
                            <span>
                                {new Date(row.ts).toLocaleTimeString()}
                            </span>
                        </div>
                        <p>{row.detail}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}
