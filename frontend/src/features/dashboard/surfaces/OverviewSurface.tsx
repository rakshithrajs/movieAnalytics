import { useMemo } from "react";

import { useAnalyticsStore } from "../../../core/store";
import type { AlertRowModel, MetricCardModel } from "../../../types/events";
import { AlertFeed } from "../components/AlertFeed";
import { FlowBar } from "../components/FlowBar";
import { MetricCard } from "../components/MetricCard";
import { RankList } from "../components/RankList";

export function OverviewSurface() {
    const byType = useAnalyticsStore((s) => s.byType);
    const alerts = useAnalyticsStore((s) => s.alerts);
    const status = useAnalyticsStore((s) => s.status);

    const globalItems = byType.global ?? [];
    const hotItems = byType.hot ?? [];
    const outlierItems = byType.outlier ?? [];
    const yearBestItems = byType.year_best_genre ?? [];
    const yearAvgItems = byType.year_avg ?? [];
    const yearActivityItems = byType.year_activity ?? [];

    const latestGlobal = globalItems[globalItems.length - 1];
    const topHot = useMemo(() => {
        return [...hotItems].sort(
            (a, b) =>
                Number(b.payload?.score ?? 0) - Number(a.payload?.score ?? 0),
        )[0];
    }, [hotItems]);

    const movieLabel = (payload: Record<string, unknown> | undefined) => {
        const id = String(payload?.movieId ?? "-");
        const title = String(payload?.movieTitle ?? "").trim();
        if (!title || title.toLowerCase() === "unknown movie") {
            return `Movie #${id}`;
        }
        return title;
    };

    const cards = useMemo<MetricCardModel[]>(() => {
        const latestHot = hotItems[hotItems.length - 1];
        const latestYearBest = yearBestItems[yearBestItems.length - 1];
        const topYearActivity = [...yearActivityItems].sort(
            (a, b) =>
                Number(b.payload?.count ?? 0) - Number(a.payload?.count ?? 0),
        )[0];

        const bestGenreLabel =
            latestYearBest ?
                `${String(latestYearBest.payload?.genre ?? "-")} (${String(latestYearBest.payload?.year ?? "-")})`
            :   "-";

        const activeYearLabel =
            topYearActivity ?
                `${String(topYearActivity.payload?.year ?? "-")} (${String(topYearActivity.payload?.count ?? 0)})`
            :   "-";

        return [
            {
                label: "Connection",
                value: status === "connected" ? "LIVE" : status.toUpperCase(),
            },
            {
                label: "Global Average Rating",
                value: Number(latestGlobal?.payload?.avg ?? 0).toFixed(2),
                emphasis: "highlight",
            },
            {
                label: "Leading Movie Score",
                value: Number(latestHot?.payload?.score ?? 0).toFixed(2),
            },
            {
                label: "Alerts in Current Window",
                value: String(outlierItems.length),
                emphasis: outlierItems.length > 0 ? "highlight" : "normal",
            },
            {
                label: "Best Genre (Latest Year)",
                value: bestGenreLabel,
            },
            {
                label: "Most Active Year",
                value: activeYearLabel,
            },
        ];
    }, [
        globalItems,
        hotItems,
        outlierItems.length,
        status,
        yearBestItems,
        yearActivityItems,
    ]);

    const shortLabel = (value: string, max = 10) => {
        if (value.length <= max) {
            return value;
        }
        return `${value.slice(0, max - 1)}…`;
    };

    const genreBars = useMemo(() => {
        return [...(byType.genre ?? [])]
            .sort(
                (a, b) =>
                    Number(b.payload?.avg ?? 0) - Number(a.payload?.avg ?? 0),
            )
            .slice(0, 6)
            .map((item) => {
                const genre = String(item.payload?.genre ?? "Unknown");
                return {
                    label: shortLabel(genre, 9),
                    value: Number(item.payload?.avg ?? 0),
                };
            });
    }, [byType.genre]);

    const yearAvgBars = useMemo(() => {
        const latestByYear = new Map<number, (typeof yearAvgItems)[number]>();

        for (const item of yearAvgItems) {
            const year = Number(item.payload?.year ?? NaN);
            if (!Number.isFinite(year)) {
                continue;
            }
            latestByYear.set(year, item);
        }

        return [...latestByYear.values()]
            .sort(
                (a, b) =>
                    Number(b.payload?.avg_rating ?? 0) -
                    Number(a.payload?.avg_rating ?? 0),
            )
            .slice(0, 6)
            .map((item) => ({
                label: String(item.payload?.year ?? "-"),
                value: Number(item.payload?.avg_rating ?? 0),
            }));
    }, [yearAvgItems]);

    const hotRanks = useMemo(() => {
        return [...(hotItems ?? [])]
            .slice(-15)
            .map((item) => ({
                name: movieLabel(item.payload),
                meta: `ID ${String(item.payload?.movieId ?? "-")}`,
                score: Number(item.payload?.score ?? 0),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }, [hotItems]);

    const yearBestRows = useMemo(() => {
        const latestByYear = new Map<number, (typeof yearBestItems)[number]>();

        for (const item of yearBestItems) {
            const year = Number(item.payload?.year ?? NaN);
            if (!Number.isFinite(year)) {
                continue;
            }
            latestByYear.set(year, item);
        }

        return [...latestByYear.values()]
            .sort(
                (a, b) =>
                    Number(b.payload?.year ?? 0) -
                    Number(a.payload?.year ?? 0),
            )
            .slice(0, 8)
            .map((item) => ({
                name: `${String(item.payload?.year ?? "-")} · ${String(item.payload?.genre ?? "Unknown")}`,
                meta: `${String(item.payload?.count ?? 0)} ratings`,
                score: Number(item.payload?.avg_rating ?? 0),
            }));
    }, [yearBestItems]);

    const alertRows = useMemo<AlertRowModel[]>(() => {
        const latestAlerts = alerts.slice(-6).reverse();
        return latestAlerts.map((alert) => {
            const payload = alert.payload ?? {};
            const movieTitle = movieLabel(payload);
            const detail =
                alert.type === "outlier" ?
                    `${movieTitle} deviated from global average (diff ${String(payload.diff ?? 0)}).`
                :   `${movieTitle} trend shift ${String(payload.trend ?? payload.score ?? 0)}.`;

            return {
                severity: alert.severity,
                title: `${alert.type.toUpperCase()} · ${alert.subtype}`,
                detail,
                ts: alert.ts,
            };
        });
    }, [alerts]);

    return (
        <section className="surface-grid">
            <div className="card-grid">
                {cards.map((card) => (
                    <MetricCard key={card.label} model={card} />
                ))}
            </div>

            <section className="panel panel-spotlight">
                <header className="panel-header">
                    <h3>Top Movie Right Now</h3>
                </header>
                <p className="spotlight-title">
                    {movieLabel(topHot?.payload)}
                </p>
                <p className="spotlight-meta">
                    Score {Number(topHot?.payload?.score ?? 0).toFixed(2)} ·
                    Average{" "}
                    {Number(
                        topHot?.payload?.avg ??
                            latestGlobal?.payload?.avg ??
                            0,
                    ).toFixed(2)}
                </p>
                <p className="panel-note">
                    This ranks movies by rating quality and number of ratings.
                </p>
            </section>

            <FlowBar
                title="Top Genres (Average Rating)"
                data={genreBars}
                className="panel-genre"
            />
            <RankList
                title="Top Movies"
                rows={hotRanks}
                className="panel-hot"
            />
            <RankList
                title="Best Genre by Year"
                rows={yearBestRows}
                className="panel-year-best"
            />
            <FlowBar
                title="Top Years (Average Rating)"
                data={yearAvgBars}
                className="panel-year-avg"
            />
            <AlertFeed title="Important Changes" rows={alertRows} />
        </section>
    );
}
