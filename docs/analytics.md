# Analytics Catalog

This document describes each analytics stream published by Flink and consumed by the dashboard.

## Existing analytics

- `movie`: movie-level average/count and weighted score
- `genre`: genre-level average/count
- `tag`: tag-level average/count
- `global`: global average/count
- `user`: user-level average/count
- `time`: hour-of-day average/count
- `trend`: change in movie average score
- `hot`: movie momentum score
- `distribution`: per-movie rating distribution (1..5)
- `active_user`: rating activity by user
- `outlier`: movie average deviating from global average

## Newly added analytics

## 1) `year_best_genre`

Purpose: answers "Which genre had the highest rating in a given year?"

Payload fields:

- `year`: rating year (derived from Unix timestamp)
- `genre`: winning genre for that year/window
- `avg_rating`: average rating of the winning genre
- `count`: number of ratings contributing to that year+genre

Logic summary:

1. Expand each record into `(year, genre, rating, 1)` tuples.
2. Aggregate to per `(year, genre)` average.
3. For each year, select row with highest `avg_rating` (tie-break by higher `count`).

## 2) `year_avg`

Purpose: year-wise quality trend.

Payload fields:

- `year`
- `avg_rating`
- `count`

Logic summary:

- Aggregate all ratings by year and compute average.

## 3) `year_activity`

Purpose: year-wise rating volume trend.

Payload fields:

- `year`
- `count`

Logic summary:

- Count how many ratings belong to each year.

## Notes on windows

These analytics are computed in tumbling processing-time windows (`WINDOW_SECONDS`, currently 10s), so values refresh continuously while stream data arrives.
