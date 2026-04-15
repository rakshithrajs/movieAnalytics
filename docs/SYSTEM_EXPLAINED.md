# Real-Time Movie Analytics System: A Complete Guide

> This document explains how the entire system works in simple terms. It's meant for anyone who wants to understand the architecture without needing deep technical knowledge.

---

## Table of Contents

1. [What is This System?](#what-is-this-system)
2. [The Big Picture](#the-big-picture)
3. [How Data Flows Through the System](#how-data-flows-through-the-system)
4. [Understanding Each Component](#understanding-each-component)
5. [The Streaming Pipeline Deep Dive](#the-streaming-pipeline-deep-dive)
6. [The Real-Time Dashboard](#the-real-time-dashboard)
7. [Event Types Explained](#event-types-explained)
8. [How Everything Connects](#how-everything-connects)
9. [Common Questions Answered](#common-questions-answered)

---

## What is This System?

Imagine you're running a movie streaming platform like Netflix. Every second, thousands of users rate movies. You want to know:

- Which movies are trending *right now*?
- What genres are most popular this year?
- Are there any unusual rating patterns (like sudden spikes or drops)?
- What's the overall average rating across all movies?

This system answers all those questions **in real-time**. When someone rates a movie, within seconds, the dashboard updates to show that rating's effect on various statistics.

### The Problem It Solves

Traditional analytics systems work in "batch" mode—they collect data over time and process it later. But what if you want to see insights *immediately*? That's where **streaming analytics** comes in.

This system processes movie ratings as they arrive, continuously updating:
- Average ratings per movie, genre, and user
- Trending scores (combining rating quality + quantity)
- Year-based analytics (best genre per year, yearly averages)
- Outlier detection (movies that deviate from normal)
- Hot movies (calculated using a formula that rewards both quality and popularity)

---

## The Big Picture

Here's a visual overview of the entire system:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                            THE BIG PICTURE                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────┐
                                    │   YOUR       │
                                    │   BROWSER    │
                                    │   (React     │
                                    │   Dashboard) │
                                    └──────┬───────┘
                                           │
                                           │ WebSocket Connection
                                           │ (Real-time updates)
                                           │
                                    ┌──────▼───────┐
                                    │   FastAPI    │
                                    │   Backend    │
                                    │   (Python)   │
                                    └──────┬───────┘
                                           │
                                           │ Redis Stream
                                           │ (Event Bus)
                                           │
                                    ┌──────▼───────┐
                                    │   Apache     │
                                    │   Flink      │
                                    │   (Streaming │
                                    │    Engine)   │
                                    └──────┬───────┘
                                           │
                                           │ Kafka Topic
                                           │ (Message Queue)
                                           │
                                    ┌──────▼───────┐
                                    │   Kafka      │
                                    │   Producer   │
                                    │   (Data      │
                                    │   Source)    │
                                    └──────┬───────┘
                                           │
                                    ┌──────▼───────┐
                                    │   MovieLens  │
                                    │   Dataset    │
                                    │   (CSV       │
                                    │   Files)     │
                                    └──────────────┘
```

### In Plain English

1. **MovieLens Dataset** — Contains movie information and user ratings
2. **Kafka Producer** — Reads the dataset and sends each rating as a message
3. **Apache Flink** — Processes these messages and calculates statistics
4. **Redis Stream** — Holds the calculated results for the backend to read
5. **FastAPI Backend** — Sends these results to connected browsers
6. **Your Browser** — Shows the live dashboard with constantly updating numbers

---

## How Data Flows Through the System

Let's trace what happens when a single movie rating enters the system:

### Step-by-Step Journey of a Rating

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                     JOURNEY OF A SINGLE RATING                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

Step 1: A Rating is Born
┌─────────────────────────────────────────────────────┐
│  CSV File Entry:                                    │
│  {                                                  │
│    "userId": 123,                                   │
│    "movieId": 456,                                  │
│    "rating": 4.5,                                   │
│    "timestamp": 1260759144                          │
│  }                                                  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
Step 2: Enriched with Movie Data
┌─────────────────────────────────────────────────────┐
│  Enriched Message:                                  │
│  {                                                  │
│    "movieId": 456,                                  │
│    "movieTitle": "Toy Story (1995)",                │
│    "rating": 4.5,                                   │
│    "userId": 123,                                   │
│    "timestamp": 1260759144,                          │
│    "genres": ["Adventure", "Animation", "Comedy"],   │
│    "tags": ["funny", "pixar", "classic"]             │
│  }                                                  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
Step 3: Sent to Kafka
┌─────────────────────────────────────────────────────┐
│  Kafka Topic: "movie_ratings"                      │
│  The message sits here waiting to be processed     │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
Step 4: Flink Processes It
┌─────────────────────────────────────────────────────┐
│  Flink computes MULTIPLE analytics at once:        │
│                                                     │
│  • movie stats: avg=4.5, count=1                   │
│  • genre stats: Adventure avg=4.5, Animation...    │
│  • user stats: User 123 avg=4.5                    │
│  • global stats: overall avg=4.5                    │
│  • hot score: 4.5 × log(1+1) = 3.12                 │
│  • time stats: Hour 21 avg=4.5                     │
│  • year stats: Year 2009 avg=4.5                   │
│  ... and more!                                     │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
Step 5: Results to Redis
┌─────────────────────────────────────────────────────┐
│  Redis Stream: "analytics:stream"                  │
│  Multiple events published:                         │
│  {type: "movie", movieId: 456, avg: 4.5, ...}      │
│  {type: "genre", genre: "Adventure", avg: 4.5}     │
│  {type: "hot", movieId: 456, score: 3.12}         │
│  ...etc                                             │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
Step 6: Backend Broadcasts
┌─────────────────────────────────────────────────────┐
│  FastAPI reads from Redis and sends to all         │
│  connected browsers via WebSocket                  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
Step 7: Dashboard Updates
┌─────────────────────────────────────────────────────┐
│  Your dashboard instantly shows:                    │
│  • "Toy Story" in the top movies list              │
│  • Adventure genre rating updated                   │
│  • Global average adjusted                          │
│  • If unusual, an alert appears                     │
└─────────────────────────────────────────────────────┘
```

---

## Understanding Each Component

### 1. The Data Source (MovieLens Dataset)

The system uses the **MovieLens dataset**, a famous dataset for movie recommendations. It contains:

| File | What's Inside | Example |
|------|--------------|---------|
| `movies.csv` | Movie information | `1, Toy Story (1995), Adventure|Animation|Children|Comedy|Fantasy` |
| `ratings.csv` | User ratings | `1, 31, 2.5, 1260759144` (userId, movieId, rating, timestamp) |
| `tags.csv` | User-generated tags | `15, 339, i liked it, 1458456961` |
| `links.csv` | External IDs | Links to IMDb and TMDB |

**Why this dataset?** It's realistic, well-structured, and perfect for demonstrating analytics.

---

### 2. Kafka (The Message Queue)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                            WHAT IS KAFKA?                                       │
│                                                                                 │
│   Think of Kafka as a very fast, very reliable mailbox system.                 │
│                                                                                 │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐              │
│   │  Producer   │  ───▶   │   Topic     │   ───▶  │  Consumer   │              │
│   │  (Sender)   │         │  (Mailbox)  │         │  (Reader)   │              │
│   └─────────────┘         └─────────────┘         └─────────────┘              │
│                                                                                 │
│   • Producers send messages to topics                                           │
│   • Topics hold messages until consumers read them                              │
│   • Multiple consumers can read the same message                                │
│   • Messages are stored safely even if a consumer is down                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**In this system:**
- **Topic name:** `movie_ratings`
- **Producer:** The Kafka producer script that reads CSV data
- **Consumer:** Apache Flink processing engine

---

### 3. Apache Flink (The Streaming Engine)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                          WHAT IS FLINK?                                        │
│                                                                                 │
│   Flink is like a factory assembly line that NEVER stops.                      │
│                                                                                 │
│   Messages come in one side, get processed, and results come out the other.   │
│   It handles MILLIONS of messages per second.                                  │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────┐             │
│   │                    FLINK PROCESSING                          │             │
│   │                                                              │             │
│   │   Input: Single Rating Message                               │             │
│   │          │                                                   │             │
│   │          ▼                                                   │             │
│   │   ┌─────────────────────────────────────────────┐            │             │
│   │   │         WINDOW (1 second batch)              │            │             │
│   │   │                                              │            │             │
│   │   │   Ratings arriving in this second           │            │             │
│   │   │   are grouped together for processing       │            │             │
│   │   └─────────────────────────────────────────────┘            │             │
│   │          │                                                   │             │
│   │          ▼                                                   │             │
│   │   ┌─────────────────────────────────────────────┐            │             │
│   │   │         PARALLEL COMPUTATIONS                │            │             │
│   │   │                                              │            │             │
│   │   │   ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │             │
│   │   │   │ Movie    │  │ Genre    │  │ User     │  │            │             │
│   │   │   │ Stats    │  │ Stats    │  │ Stats    │  │            │             │
│   │   │   └──────────┘  └──────────┘  └──────────┘  │            │             │
│   │   │   ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │             │
│   │   │   │ Trending │  │ Hot      │  │ Year     │  │            │             │
│   │   │   │ Analysis│  │ Movies   │  │ Analysis │  │            │             │
│   │   │   └──────────┘  └──────────┘  └──────────┘  │            │             │
│   │   └─────────────────────────────────────────────┘            │             │
│   │          │                                                   │             │
│   │          ▼                                                   │             │
│   │   Output: Multiple Analytics Events                          │             │
│   └──────────────────────────────────────────────────────────────┘             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Concept: Windowing**

Flink groups incoming ratings into "windows" (1-second batches by default). This allows it to aggregate data efficiently:

```
Ratings arriving:  ⭐  ⭐  ⭐  ⭐  ⭐  ⭐  ⭐  ⭐  ⭐  ⭐
                    │         │         │         │
                    ▼         ▼         ▼         ▼
                  Window 1  Window 2  Window 3  Window 4
                  (0-1s)    (1-2s)    (2-3s)    (3-4s)
```

Each window processes all ratings that arrived during that time period, then outputs results.

---

### 4. Redis (The Event Bus)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                            WHAT IS REDIS?                                      │
│                                                                                 │
│   Redis is a super-fast in-memory data store. Think of it as                   │
│   "sticky notes for your server" - quick to write, quick to read.              │
│                                                                                 │
│   In this system, Redis Streams acts as a conveyor belt:                       │
│                                                                                 │
│   ┌─────────┐    ┌──────────────────────────────────┐    ┌─────────┐          │
│   │  Flink  │───▶│  Redis Stream: analytics:stream  │───▶│ FastAPI │          │
│   │         │    │                                  │    │         │          │
│   │         │    │  [event1] → [event2] → [event3]  │    │         │          │
│   │         │    │                                  │    │         │          │
│   └─────────┘    └──────────────────────────────────┘    └─────────┘          │
│                                                                                 │
│   Flink writes events to the stream.                                           │
│   FastAPI reads events from the stream.                                         │
│   The stream keeps the last 100,000 events.                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Why use Redis between Flink and FastAPI?**

- **Decoupling:** Flink and FastAPI can run independently
- **Reliability:** If FastAPI restarts, it can catch up from where it left off
- **Speed:** Redis is incredibly fast (sub-millisecond latency)

---

### 5. FastAPI Backend (The WebSocket Server)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                         WHAT IS FASTAPI?                                        │
│                                                                                 │
│   FastAPI is a Python web framework that's designed for building APIs.         │
│   In this system, it does two main things:                                      │
│                                                                                 │
│   ┌───────────────────────────────────────────────────────────────┐            │
│   │                    FASTAPI BACKEND                             │            │
│   │                                                               │            │
│   │   ┌─────────────────┐         ┌─────────────────────────┐     │            │
│   │   │  Event Loop     │         │  WebSocket Manager       │     │            │
│   │   │                 │         │                          │     │            │
│   │   │  • Reads from   │         │  • Manages connections   │     │            │
│   │   │    Redis Stream  │────────▶│  • Broadcasts to rooms  │     │            │
│   │   │  • Enriches     │         │  • Handles subscriptions │     │            │
│   │   │    events       │         │                          │     │            │
│   │   │  • Updates      │         └─────────────────────────┘     │            │
│   │   │    in-memory    │                   │                     │            │
│   │   │    cache        │                   │                     │            │
│   │   └─────────────────┘                   │                     │            │
│   │                                          ▼                     │            │
│   │                              ┌─────────────────────────┐      │            │
│   │                              │  Connected Browsers     │      │            │
│   │                              │                          │      │            │
│   │                              │  🖥️ Client 1             │      │            │
│   │                              │  🖥️ Client 2             │      │            │
│   │                              │  🖥️ Client 3             │      │            │
│   │                              └─────────────────────────┘      │            │
│   └───────────────────────────────────────────────────────────────┘            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Key Components:**

1. **Event Dispatch Loop** — Continuously reads from Redis Stream
2. **Aggregate Store** — Keeps the latest state in memory (per movie, per genre, etc.)
3. **WebSocket Manager** — Manages browser connections and room subscriptions
4. **Movie Catalog** — Adds movie titles to events that don't have them

---

### 6. React Dashboard (What You See)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                         THE DASHBOARD LAYOUT                                    │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                         TOP METRICS BAR                                 │  │
│   │  ┌─────────┐  ┌─────────────────┐  ┌─────────────┐  ┌─────────────┐     │  │
│   │  │ LIVE ✓  │  │ Global Avg:3.54 │  │ Top Score   │  │ Alerts: 2   │     │  │
│   │  └─────────┘  └─────────────────┘  └─────────────┘  └─────────────┘     │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│   ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│   │   🎬 TOP MOVIE RIGHT NOW     │  │   📊 TOP GENRES BY RATING           │  │
│   │                              │  │                                      │  │
│   │   The Shawshank Redemption   │  │   Film-Noir    ████████████ 4.21    │  │
│   │   Score: 15.42               │  │   Documentary   ███████████ 4.12     │  │
│   │   Avg: 4.5 | Ratings: 120    │  │   War          ██████████ 4.01      │  │
│   │                              │  │   Drama        █████████ 3.95       │  │
│   └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                                 │
│   ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│   │   🏆 TOP MOVIES LEADERBOARD  │  │   📅 BEST GENRE BY YEAR              │  │
│   │                              │  │                                      │  │
│   │   1. Shawshank    Score 15.4 │  │   2024 · Drama      (avg 4.2)        │  │
│   │   2. Pulp Fiction  Score 14.2 │  │   2023 · Thriller   (avg 4.1)        │  │
│   │   3. Dark Knight   Score 13.8 │  │   2022 · Comedy     (avg 3.9)        │  │
│   │   4. Forrest Gump  Score 12.5 │  │   2021 · Action     (avg 3.8)        │  │
│   │                              │  │                                      │  │
│   └──────────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │   ⚠️ ALERTS (Important Changes)                                         │  │
│   │                                                                         │  │
│   │   🔴 CRITICAL: Movie #999 is an OUTLIER - rating 1.2 vs global 3.5      │  │
│   │   🟡 ELEVATED: "Titanic" trend shift +0.8 in last hour                  │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**How the Dashboard Updates:**

1. **Initial Load:** The browser connects via WebSocket and receives a **SNAPSHOT** (the current state of all analytics)
2. **Continuous Updates:** The server sends **PATCH** messages with incremental updates
3. **Alerts:** Events marked as `elevated` or `critical` severity appear in the alert feed

---

## The Streaming Pipeline Deep Dive

### What Analytics Does Flink Compute?

Flink computes **14 different analytics** simultaneously:

| Analytics Type | What It Measures | Example Output |
|---------------|------------------|----------------|
| `movie` | Per-movie statistics | `{movieId: 123, avg: 4.2, count: 50, weighted: 3.8}` |
| `genre` | Per-genre averages | `{genre: "Comedy", avg: 3.8, count: 1200}` |
| `tag` | Per-tag statistics | `{tag: "funny", avg: 4.1, count: 200}` |
| `user` | Per-user behavior | `{userId: 42, avg_rating: 3.5, count: 85}` |
| `time` | Rating patterns by hour | `{hour: 21, avg_rating: 4.0, count: 500}` |
| `global` | Overall average | `{avg: 3.54, count: 100000}` |
| `trend` | Rating changes | `{movieId: 123, trend: +0.3, current_avg: 4.2}` |
| `hot` | Trending score | `{movieId: 123, score: 12.5, avg: 4.2, count: 80}` |
| `distribution` | Rating breakdown | `{movieId: 123, dist: {1:2, 2:5, 3:10, 4:20, 5:13}}` |
| `active_user` | User activity | `{userId: 42, activity: 150}` |
| `outlier` | Unusual ratings | `{movieId: 999, avg: 1.2, global_avg: 3.5, diff: 2.3}` |
| `year_avg` | Yearly average ratings | `{year: 2020, avg_rating: 3.8, count: 5000}` |
| `year_activity` | Ratings per year | `{year: 2020, count: 5000}` |
| `year_best_genre` | Best genre per year | `{year: 2020, genre: "Drama", avg_rating: 4.2, count: 800}` |

### How Are These Calculated?

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                    HOW FLINK CALCULATES MOVIE STATS                             │
│                                                                                 │
│   Input: {movieId: 123, rating: 4.5}                                            │
│                                                                                 │
│   Step 1: Group by movieId                                                      │
│           ┌─────────────────────────────────────────────────────┐               │
│           │  All ratings for movie 123 go to the same bucket   │               │
│           └─────────────────────────────────────────────────────┘               │
│                                                                                 │
│   Step 2: Reduce within window                                                  │
│           ┌─────────────────────────────────────────────────────┐               │
│           │  Window (1 second)                                  │               │
│           │  Rating 1: 4.5                                      │               │
│           │  Rating 2: 3.0                                      │               │
│           │  Rating 3: 5.0                                      │               │
│           │  ─────────────────                                  │               │
│           │  Sum: 12.5, Count: 3                               │               │
│           └─────────────────────────────────────────────────────┘               │
│                                                                                 │
│   Step 3: Compute                                                               │
│           ┌─────────────────────────────────────────────────────┐               │
│           │  avg = sum / count = 12.5 / 3 = 4.17                │               │
│           │  weighted = (avg × count) / (count + 10)            │               │
│           │           = (4.17 × 3) / 13 = 0.96                  │               │
│           │  (Weighted favors movies with more ratings)         │               │
│           └─────────────────────────────────────────────────────┘               │
│                                                                                 │
│   Step 4: Output                                                                │
│           {type: "movie", movieId: 123, avg: 4.17, count: 3, weighted: 0.96}  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### The "Hot Score" Formula

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                         HOT SCORE CALCULATION                                   │
│                                                                                 │
│   Formula: score = average_rating × log(count + 1)                             │
│                                                                                 │
│   This formula balances QUALITY (high rating) and POPULARITY (many ratings)   │
│                                                                                 │
│   Example:                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────┐    │
│   │  Movie A: avg=5.0, count=10    →    score = 5.0 × log(11) = 11.97     │    │
│   │  Movie B: avg=4.5, count=100   →    score = 4.5 × log(101) = 20.71    │    │
│   │  Movie C: avg=4.0, count=1000  →    score = 4.0 × log(1001) = 27.64   │    │
│   └───────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│   Movie C wins because it has BOTH good ratings AND many ratings.              │
│   A movie with avg=5.0 but only 1 rating won't rank high.                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Outlier Detection

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                         OUTLIER DETECTION                                       │
│                                                                                 │
│   The system watches for movies that deviate significantly from the global     │
│   average rating.                                                               │
│                                                                                 │
│   How it works:                                                                 │
│   ┌───────────────────────────────────────────────────────────────────────┐    │
│   │                                                                       │    │
│   │   Global Average: 3.54                                                │    │
│   │   Threshold: 1.5 (movies with diff > 1.5 are outliers)                │    │
│   │                                                                       │    │
│   │   Movie A: avg=3.6, diff=0.06 → Normal (not an outlier)              │    │
│   │   Movie B: avg=1.2, diff=2.34 → OUTLIER! ⚠️                          │    │
│   │   Movie C: avg=5.0, diff=1.46 → Normal (just barely)                 │    │
│   │                                                                       │    │
│   └───────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│   Why is this useful?                                                          │
│   • Spot movies that might have data issues                                    │
│   • Find controversial movies (people either love or hate them)                │
│   • Identify potential quality problems                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## The Real-Time Dashboard

### How WebSockets Keep Everything in Sync

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                      WEBSOCKET COMMUNICATION                                    │
│                                                                                 │
│   Traditional HTTP:                                                             │
│   ┌─────────┐                              ┌─────────┐                          │
│   │ Browser │  ─── Request ───────────────▶ │ Server  │                          │
│   │         │  ◀── Response ────────────── │         │                          │
│   └─────────┘                              └─────────┘                          │
│   (Browser asks, server answers, connection closes)                            │
│                                                                                 │
│   ────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│   WebSocket:                                                                    │
│   ┌─────────┐                              ┌─────────┐                          │
│   │ Browser │  ═══════════ Connection ══════ │ Server  │                          │
│   │         │                              │         │                          │
│   │         │  ◀── Event 1 ────────────── │         │                          │
│   │         │  ◀── Event 2 ────────────── │         │                          │
│   │         │  ◀── Event 3 ────────────── │         │                          │
│   │         │  ─── Heartbeat ───────────▶ │         │                          │
│   │         │  ◀── Heartbeat ACK ───────── │         │                          │
│   │         │  ◀── Event 4 ────────────── │         │                          │
│   └─────────┘                              └─────────┘                          │
│   (Connection stays open, server pushes updates anytime)                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### The Room System

The dashboard uses a "room" concept for efficient updates:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                          ROOM-BASED SUBSCRIPTIONS                               │
│                                                                                 │
│   Instead of sending ALL updates to ALL users, each user subscribes to         │
│   specific "rooms" (types of analytics they care about).                        │
│                                                                                 │
│   Available Rooms:                                                               │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │  movie      - Movie statistics updates                                  │  │
│   │  genre      - Genre rating updates                                       │  │
│   │  tag        - Tag-based updates                                          │  │
│   │  user       - User activity updates                                      │  │
│   │  hot        - Hot movies list                                            │  │
│   │  trend      - Rating trend changes                                       │  │
│   │  outlier    - Outlier alerts                                             │  │
│   │  global     - Global average updates                                     │  │
│   │  time       - Hourly patterns                                            │  │
│   │  year_avg   - Yearly averages                                            │  │
│   │  year_activity - Rating volume per year                                  │  │
│   │  year_best_genre - Best genre per year                                    │  │
│   │  alerts     - Important notifications only                               │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│   Client subscribes: {"action":"subscribe","rooms":["movie","hot","alerts"]}   │
│   Server sends updates ONLY for subscribed rooms.                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Snapshot + Patch Pattern

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                    SNAPSHOT + PATCH PROTOCOL                                    │
│                                                                                 │
│   When a browser connects:                                                       │
│                                                                                 │
│   Step 1: Server sends FULL STATE                                               │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  {                                                                      │   │
│   │    "kind": "SNAPSHOT",                                                 │   │
│   │    "seq": 1523,                                                         │   │
│   │    "state": {                                                           │   │
│   │      "by_type": {                                                       │   │
│   │        "movie": [{movieId:1, avg:4.5}, {movieId:2, avg:3.8}, ...],     │   │
│   │        "genre": [{genre:"Comedy", avg:3.9}, ...],                      │   │
│   │        ...                                                              │   │
│   │      },                                                                 │   │
│   │      "latest": {                                                        │   │
│   │        "movie:1": {movieId:1, avg:4.5},                                 │   │
│   │        "genre:Comedy": {genre:"Comedy", avg:3.9},                      │   │
│   │        ...                                                              │   │
│   │      }                                                                  │   │
│   │    }                                                                    │   │
│   │  }                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   Step 2: Browser receives INCREMENTAL UPDATES                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  {                                                                      │   │
│   │    "kind": "PATCH",                                                     │   │
│   │    "seq": 1524,                                                         │   │
│   │    "room": "movie",                                                     │   │
│   │    "event": {movieId: 123, avg: 4.2, count: 50, ...}                   │   │
│   │  }                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│   The browser only needs to apply the change, not reload everything.           │
│                                                                                 │
│   If connection drops:                                                          │
│   ─── Browser reconnects                                                       │
│   ─── Browser sends: {"action":"snapshot"}                                     │
│   ─── Server sends full SNAPSHOT again                                         │
│   ─── Browser continues receiving PATCH messages                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Event Types Explained

### Understanding the Event Structure

Every event follows the same structure:

```json
{
  "id": "uuid-1234-5678",
  "ts": "2024-01-15T10:30:45.123Z",
  "type": "movie",
  "subtype": "value",
  "payload": {
    // type-specific data
  },
  "severity": "normal"
}
```

| Field | What It Means |
|-------|--------------|
| `id` | Unique identifier for this event |
| `ts` | Timestamp when created (ISO 8601) |
| `type` | What kind of analytics (movie, genre, hot, outlier, etc.) |
| `subtype` | More specific classification (value, rank_change, anomaly, velocity) |
| `payload` | The actual data |
| `severity` | How important (normal, elevated, critical) |

### Severity Levels

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                          SEVERITY LEVELS                                        │
│                                                                                 │
│   ┌─────────────────────────────────────────────────────────────────────────┐  │
│   │                                                                         │  │
│   │   🟢 NORMAL (Default)                                                   │  │
│   │      - Regular updates                                                  │  │
│   │      - Shown in regular dashboard panels                                │  │
│   │      - No special attention needed                                      │  │
│   │                                                                         │  │
│   │   🟡 ELEVATED (Warning)                                                 │  │
│   │      - Something unusual but not critical                              │  │
│   │      - Trend shifts ≥ 0.5                                               │  │
│   │      - Hot scores ≥ 12                                                  │  │
│   │      - Appears in alerts panel                                          │  │
│   │                                                                         │  │
│   │   🔴 CRITICAL (Important)                                               │  │
│   │      - Something significant requiring attention                        │  │
│   │      - Trend shifts ≥ 1.0                                               │  │
│   │      - Outliers with diff ≥ 2.0                                        │  │
│   │      - Highlighted in alerts panel                                      │  │
│   │                                                                         │  │
│   └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## How Everything Connects

### The Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                             │
│                              COMPLETE SYSTEM ARCHITECTURE                                   │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                                    DATA LAYER                                          │ │
│  │                                                                                       │ │
│  │   ┌─────────────────┐                                                                 │ │
│  │   │  MovieLens      │    ┌─────────────────┐    ┌─────────────────┐                   │ │
│  │   │  Dataset        │    │  Kafka           │    │  Redis          │                   │ │
│  │   │  (CSV Files)    │    │  (Message Queue) │    │  (Event Stream) │                   │ │
│  │   │                 │    │                 │    │                 │                   │ │
│  │   │  • movies.csv   │    │  Topic:         │    │  Stream:        │                   │ │
│  │   │  • ratings.csv  │    │  movie_ratings  │    │  analytics:     │                   │ │
│  │   │  • tags.csv     │    │                 │    │  stream         │                   │ │
│  │   │  • links.csv    │    │                 │    │                 │                   │ │
│  │   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘                   │ │
│  │            │                      │                      ▲                            │ │
│  └────────────┼──────────────────────┼──────────────────────┼────────────────────────────┘ │
│               │                      │                      │                              │
│  ┌────────────┼──────────────────────┼──────────────────────┼────────────────────────────┐ │
│  │            ▼                      ▼                      │    PROCESSING LAYER           │ │
│  │   ┌─────────────────┐    ┌─────────────────┐          │                              │ │
│  │   │  Kafka          │    │  Apache Flink   │          │                              │ │
│  │   │  Producer       │    │  (PyFlink)      │          │                              │ │
│  │   │                 │    │                 │          │                              │ │
│  │   │  Reads CSV      │    │  Windowed       │          │                              │ │
│  │   │  Enriches data   │───▶│  Aggregation    │──────────┘                              │ │
│  │   │  Sends to Kafka │    │  Computes 14   │                                        │ │
│  │   │                 │    │  analytics      │                                        │ │
│  │   └─────────────────┘    └─────────────────┘                                        │ │
│  │                                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                          │                                                │
│  ┌───────────────────────────────────────┼───────────────────────────────────────────────┐ │
│  │                                       ▼              APPLICATION LAYER               │ │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │   │                         FastAPI Backend                                       │     │ │
│  │   │                                                                              │     │ │
│  │   │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │     │ │
│  │   │   │  Redis Bus        │  │  Aggregate Store   │  │  WebSocket Manager │        │     │ │
│  │   │   │                   │  │                   │  │                   │        │     │ │
│  │   │   │  • Connect to     │  │  • In-memory      │  │  • Manage conns   │        │     │ │
│  │   │   │    Redis Stream   │──▶│    cache         │──▶│  • Broadcast to   │        │     │ │
│  │   │   │  • Read events    │  │  • Latest state   │  │    clients        │        │     │ │
│  │   │   │  • Yield events   │  │  • By type/entity │  │  • Room subs      │        │     │ │
│  │   │   └───────────────────┘  └───────────────────┘  └───────────────────┘        │     │ │
│  │   │                                                                              │     │ │
│  │   │   ┌───────────────────┐  ┌───────────────────┐                               │     │ │
│  │   │   │  Movie Catalog   │  │  REST Endpoints   │                               │     │ │
│  │   │   │                   │  │                   │                               │     │ │
│  │   │   │  • Load titles   │  │  • /health       │                               │     │ │
│  │   │   │  • Enrich events │  │  • /metrics      │                               │     │ │
│  │   │   └───────────────────┘  │  • /snapshot    │                               │     │ │
│  │   │                          │  • /ws/stream   │                               │     │ │
│  │   │                          └───────────────────┘                               │     │ │
│  │   └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                          │                                           │ │
│  └──────────────────────────────────────────┼───────────────────────────────────────────┘ │
│                                             │                                              │
│  ┌──────────────────────────────────────────┼───────────────────────────────────────────┐ │
│  │                                          ▼               PRESENTATION LAYER           │ │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │   │                         React Frontend                                        │     │ │
│  │   │                                                                              │     │ │
│  │   │   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │     │ │
│  │   │   │  WebSocket       │  │  Zustand Store    │  │  Dashboard UI     │        │     │ │
│  │   │   │  Client          │  │                   │  │                   │        │     │ │
│  │   │   │                   │  │  • byType        │  │  • Overview       │        │     │ │
│  │   │   │  • Connect       │──▶│  • latestByEntity│──▶│    Surface        │        │     │ │
│  │   │   │  • Reconnect     │  │  • alerts        │  │  • Metric Cards   │        │     │ │
│  │   │   │  • Auto-resub     │  │  • sequence      │  │  • Rank Lists     │        │     │ │
│  │   │   └───────────────────┘  └───────────────────┘  │  • Alert Feed     │        │     │ │
│  │   │                                                 │  • Flow Bars       │        │     │ │
│  │   │                                                 └───────────────────┘        │     │ │
│  │   └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Questions Answered

### Q: Why use both Kafka and Redis?

```
Kafka is for RELIABILITY:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  • Messages persist even if the consumer crashes                               │
│  • Multiple consumers can read the same data                                  │
│  • Designed for high throughput and durability                                │
│  • Used for the heavy lifting of stream processing                            │
└─────────────────────────────────────────────────────────────────────────────────┘

Redis is for SPEED:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  • Sub-millisecond latency for reads/writes                                   │
│  • Perfect for real-time browser updates                                       │
│  • Simpler protocol for the backend to consume                                │
│  • Used for the final mile to the frontend                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Q: What if Flink or the Backend goes down?

```
Scenario 1: Flink goes down
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. Kafka continues to buffer incoming messages                                │
│  2. When Flink restarts, it resumes from where it left off                    │
│  3. No data lost! (Kafka retains messages)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

Scenario 2: Backend goes down
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. Flink continues writing to Redis                                           │
│  2. Redis Stream holds up to 100,000 events                                    │
│  3. When backend restarts, it reads from Redis (catches up)                    │
│  4. Browsers auto-reconnect and get a fresh snapshot                           │
└─────────────────────────────────────────────────────────────────────────────────┘

Scenario 3: Browser disconnects
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. Backend continues processing normally                                       │
│  2. Browser's WebSocket client auto-reconnects with exponential backoff       │
│  3. On reconnect, browser requests a snapshot to get current state              │
│  4. Then continues receiving patches                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Q: How does the system handle scale?

```
Current Design (Single Instance):
┌─────────────────────────────────────────────────────────────────────────────────┐
│  • Flink: Single parallelism (can be increased)                                │
│  • FastAPI: Single instance (can be load-balanced)                             │
│  • Redis: Single instance (can use Redis Cluster)                              │
│  • Kafka: Single topic/partition (can be partitioned)                          │
└─────────────────────────────────────────────────────────────────────────────────┘

Scaling Options:
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Horizontal:                                                                   │
│  • Multiple Flink workers for parallel processing                              │
│  • Multiple FastAPI instances behind a load balancer                          │
│  • Redis Cluster for distributed storage                                       │
│  • Kafka partitions for parallel consumption                                   │
│                                                                                │
│  Vertical:                                                                     │
│  • More CPU/RAM for Flink workers                                              │
│  • More connections per FastAPI instance                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Q: How accurate are the statistics?

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│   The statistics are ACCURATE WITHIN THE WINDOW CONTEXT                        │
│                                                                                │
│   What this means:                                                             │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                                                                        │   │
│   │   Each window (1 second) computes correct aggregates:                  │   │
│   │   • Sum and count are exact                                            │   │
│   │   • Average is correctly computed                                      │   │
│   │   • No data is lost or double-counted                                  │   │
│   │                                                                        │   │
│   │   However:                                                             │   │
│   │   • Global state is maintained in-process (restarts reset)             │   │
│   │   • Trend detection compares current vs. previous window              │   │
│   │   • Outlier detection uses in-process global average                   │   │
│   │                                                                        │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│   For production, you'd want:                                                  │
│   • Flink's managed state for persistence across restarts                      │
│   • Checkpointing for exactly-once semantics                                   │
│   • Event-time processing with watermarks                                     │
│                                                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure Reference

```
/home/raj/BigData/
│
├── backend/                          # FastAPI Backend
│   ├── app/
│   │   ├── main.py                   # Entry point, WebSocket, REST endpoints
│   │   ├── core/
│   │   │   └── settings.py          # Configuration (Redis URL, etc.)
│   │   ├── services/
│   │   │   ├── redis_bus.py         # Redis Stream consumer
│   │   │   ├── aggregates.py         # In-memory state store
│   │   │   └── movie_catalog.py     # Movie title enrichment
│   │   ├── ws/
│   │   │   └── manager.py           # WebSocket connection manager
│   │   └── models/
│   │       └── events.py            # Event type definitions
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── core/
│   │   │   ├── store.ts             # Zustand state management
│   │   │   └── ws-client.ts         # WebSocket client
│   │   ├── features/dashboard/
│   │   │   ├── components/          # UI components
│   │   │   │   ├── MetricCard.tsx
│   │   │   │   ├── RankList.tsx
│   │   │   │   ├── AlertFeed.tsx
│   │   │   │   └── FlowBar.tsx
│   │   │   └── surfaces/
│   │   │       └── OverviewSurface.tsx  # Main dashboard
│   │   ├── types/
│   │   │   └── events.ts            # TypeScript interfaces
│   │   └── App.tsx
│   ├── package.json
│   └── .env
│
├── scripts/                          # Streaming Jobs
│   ├── kafka_producer.py            # Reads CSV, sends to Kafka
│   ├── flink_kafka_stream.py        # Flink streaming job
│   └── run_demo.sh                  # One-command launcher
│
├── data/                             # Dataset
│   └── ml-latest-small/
│       ├── movies.csv
│       ├── ratings.csv
│       ├── tags.csv
│       └── links.csv
│
├── contracts/
│   └── event-schema.json            # JSON Schema for events
│
├── docs/                             # Documentation
│   ├── architecture.md
│   ├── api.md
│   └── analytics.md
│
└── flink_jars/                       # Flink Kafka Connector
    ├── flink-connector-kafka-1.17.2.jar
    └── kafka-clients-3.4.0.jar
```

---

## Quick Start Commands

```bash
# 1. Start dependencies (Redis, Kafka, Zookeeper)
# Make sure these are running on their default ports

# 2. Create Kafka topic
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic movie_ratings \
  --partitions 1 \
  --replication-factor 1

# 3. Start backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Start frontend (new terminal)
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173

# 5. Start Flink job (new terminal)
cd scripts
python flink_kafka_stream.py

# 6. Start Kafka producer (new terminal)
cd scripts
python kafka_producer.py

# 7. Open dashboard
open http://localhost:5173
```

Or use the one-command launcher:
```bash
bash scripts/run_demo.sh
```

---

## Summary

This system is a complete example of **real-time analytics** architecture:

1. **Data Ingestion** — Kafka handles reliable message streaming
2. **Stream Processing** — Flink computes multiple analytics simultaneously
3. **Event Delivery** — Redis provides low-latency event bus
4. **API Layer** — FastAPI manages WebSocket connections and state
5. **Visualization** — React dashboard shows live updates

The key insight is that every component is optimized for its specific role:
- Kafka for durability and throughput
- Flink for complex event processing
- Redis for speed
- FastAPI for async I/O
- React for reactive UI

This pattern (sometimes called the "Kappa Architecture") is suitable for many real-time analytics use cases beyond movie ratings: financial tickers, IoT sensor data, social media feeds, game leaderboards, and more.

---

*Last updated: March 2026*