import { useMemo } from "react";

import { useAnalyticsStore } from "../core/store";
import { GenreCards } from "./components/GenreCards";
import { HeroStream } from "./components/HeroStream";
import { Leaderboard } from "./components/Leaderboard";
import { MetricsStrip } from "./components/MetricsStrip";
import { AlertStream } from "./components/AlertStream";
import { YearAnalysis } from "./components/YearAnalysis";
import { ActivityPulse } from "./components/ActivityPulse";

const EMPTY_ITEMS: Array<Record<string, unknown>> = [];

export function OverviewSurface() {
    const byType = useAnalyticsStore((s) => s.byType);
    const alerts = useAnalyticsStore((s) => s.alerts);
    const status = useAnalyticsStore((s) => s.status);

    const globalItems = (byType?.global ??
        EMPTY_ITEMS) as typeof byType.global;
    const hotItems = (byType?.hot ?? EMPTY_ITEMS) as typeof byType.hot;
    const genreItems = (byType?.genre ?? EMPTY_ITEMS) as typeof byType.genre;
    const yearBestItems = (byType?.year_best_genre ??
        EMPTY_ITEMS) as typeof byType.year_best_genre;
    const yearAvgItems = (byType?.year_avg ??
        EMPTY_ITEMS) as typeof byType.year_avg;

    const latestGlobal = globalItems[globalItems.length - 1];

    const topMovie = useMemo(() => {
        return [...hotItems].sort(
            (a, b) =>
                Number(b.payload?.score ?? 0) - Number(a.payload?.score ?? 0),
        )[0];
    }, [hotItems]);

    const topGenres = useMemo(() => {
        return [...genreItems]
            .sort(
                (a, b) =>
                    Number(b.payload?.avg ?? 0) - Number(a.payload?.avg ?? 0),
            )
            .slice(0, 6);
    }, [genreItems]);

    const leaderboardData = useMemo(() => {
        const latestByMovie = new Map<
            string,
            { movieId: string; title: string; score: number; avg: number }
        >();

        for (let index = hotItems.length - 1; index >= 0; index -= 1) {
            const item = hotItems[index];
            const movieId = String(item.payload?.movieId ?? "-");

            if (latestByMovie.has(movieId)) {
                continue;
            }

            latestByMovie.set(movieId, {
                movieId,
                title: String(item.payload?.movieTitle ?? "Unknown Movie"),
                score: Number(item.payload?.score ?? 0),
                avg: Number(item.payload?.avg ?? 0),
            });

            if (latestByMovie.size >= 120) {
                break;
            }
        }

        return [...latestByMovie.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }, [hotItems]);

    const yearAnalysisData = useMemo(() => {
        const byYear = new Map<
            number,
            { avg: number; count: number; bestGenre: string }
        >();

        for (const item of yearAvgItems) {
            const year = Number(item.payload?.year ?? NaN);
            if (!Number.isFinite(year)) continue;
            byYear.set(year, {
                avg: Number(item.payload?.avg_rating ?? 0),
                count: Number(item.payload?.count ?? 0),
                bestGenre: "",
            });
        }

        for (const item of yearBestItems) {
            const year = Number(item.payload?.year ?? NaN);
            if (!Number.isFinite(year)) continue;
            const existing = byYear.get(year);
            if (existing) {
                existing.bestGenre = String(item.payload?.genre ?? "");
            }
        }

        return [...byYear.entries()]
            .sort((a, b) => b[0] - a[0])
            .slice(0, 6)
            .map(([year, data]) => ({ year, ...data }));
    }, [yearAvgItems, yearBestItems]);

    const recentAlerts = useMemo(() => {
        return alerts.slice(-8).reverse();
    }, [alerts]);

    const metrics = useMemo(() => {
        const totalRatings = globalItems.reduce(
            (sum, item) => sum + Number(item.payload?.count ?? 0),
            0,
        );

        return [
            {
                label: "Global Average",
                value: Number(latestGlobal?.payload?.avg ?? 0).toFixed(2),
                highlight: true,
            },
            {
                label: "Movies Analyzed",
                value: leaderboardData.length.toString(),
            },
            {
                label: "Genres Tracked",
                value: topGenres.length.toString(),
            },
            {
                label: "Rating Events",
                value: totalRatings.toLocaleString(),
            },
        ];
    }, [latestGlobal, leaderboardData.length, topGenres.length, globalItems]);

    return (
        <main className="main-content">
            <div className="primary-column">
                <HeroStream
                    movieTitle={String(
                        topMovie?.payload?.movieTitle ?? "Waiting...",
                    )}
                    score={Number(topMovie?.payload?.score ?? 0)}
                    avg={Number(
                        topMovie?.payload?.avg ??
                            latestGlobal?.payload?.avg ??
                            0,
                    )}
                    status={status}
                />

                <MetricsStrip metrics={metrics} />

                <section>
                    <div className="section-label">Genre Performance</div>
                    <GenreCards genres={topGenres} />
                </section>

                <section>
                    <div className="section-label">Movie Leaderboard</div>
                    <Leaderboard rows={leaderboardData} />
                </section>
            </div>

            <aside className="sidebar-column">
                <ActivityPulse status={status} />

                <section className="data-panel">
                    <header className="panel-header">
                        <h3 className="panel-title">Year Analysis</h3>
                    </header>
                    <YearAnalysis data={yearAnalysisData} />
                </section>

                <section className="data-panel">
                    <header className="panel-header">
                        <h3 className="panel-title">Alert Stream</h3>
                        <span className="panel-badge">
                            {alerts.length} events
                        </span>
                    </header>
                    <AlertStream alerts={recentAlerts} />
                </section>
            </aside>
        </main>
    );
}
