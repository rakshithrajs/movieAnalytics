# Setup Guide (Current Full Stack)

This repository now runs as a realtime analytics system:

Kafka producer → PyFlink analytics → Redis Stream → FastAPI WebSocket API → React dashboard.

New analytics added:

- Best genre by year (`year_best_genre`)
- Year-wise average rating (`year_avg`)
- Year-wise rating activity volume (`year_activity`)

## Prerequisites

- Python 3.10+
- Node.js 20+
- Java 17+
- Redis 7+
- Kafka + Zookeeper

Quick check:

```bash
python --version
node --version
java -version
redis-server --version
```

## Project paths used by setup

- Backend API: `backend/`
- Frontend dashboard: `frontend/`
- Stream jobs: `scripts/`
- Dataset: `data/ml-latest-small/`
- Connector jars: `flink_jars/`

## 1) Dataset

Required files in `data/ml-latest-small/`:

- `movies.csv`
- `ratings.csv`
- `tags.csv`
- `links.csv`

If needed, download MovieLens latest small and place files in that directory.

## 2) Backend setup (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Run backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Key backend env defaults:

- `REDIS_URL=redis://localhost:6379/0`
- `REDIS_STREAM_KEY=analytics:stream`

## 3) Frontend setup (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend env:

- `VITE_WS_URL=ws://localhost:8000/ws/stream`

Open: `http://localhost:5173`

## 4) Kafka topic

Start Zookeeper and Kafka, then create topic:

```bash
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --if-not-exists \
  --topic movie_ratings \
  --partitions 1 \
  --replication-factor 1
```

## 5) Streaming jobs (producer + Flink)

Install script dependencies in your Python env:

```bash
pip install pandas kafka-python pyflink redis
```

Required jars:

- `flink_jars/flink-connector-kafka-1.17.2.jar`
- `flink_jars/kafka-clients-3.4.0.jar`

Run producer:

```bash
python scripts/kafka_producer.py
```

Run Flink job:

```bash
python scripts/flink_kafka_stream.py
```

Optional Flink env overrides:

```bash
export ENABLE_REDIS_SINK=1
export REDIS_URL=redis://localhost:6379/0
export REDIS_STREAM_KEY=analytics:stream
```

## 6) One-command local launcher

```bash
bash scripts/run_demo.sh
```

This checks Redis, starts backend/frontend, and prints the producer/Flink commands.

## 7) Validation

- Health: `GET http://localhost:8000/health`
- Metrics: `GET http://localhost:8000/metrics`
- Snapshot: `GET http://localhost:8000/snapshot`
- WebSocket: `ws://localhost:8000/ws/stream`

Example WS subscribe:

```json
{"action":"subscribe","rooms":["movie","genre","hot","alerts"]}
```

## 8) Recommended startup order

1. Redis
2. Kafka + Zookeeper
3. Create topic `movie_ratings`
4. Backend
5. Frontend
6. Flink job
7. Producer
8. Open dashboard

## 9) Troubleshooting

- Dashboard offline: verify backend + `VITE_WS_URL`.
- No updates: verify Flink running with Redis sink enabled.
- No events: verify producer and Kafka topic.
- Flink errors: verify Java and required jars.
- Backend idle: verify `REDIS_URL`/`REDIS_STREAM_KEY` match Flink.

## 10) Extra docs

- `docs/architecture.md`
- `docs/api.md`
- `docs/analytics.md`
- `docs/operations.md`
- `docs/demo.md`

---

## Legacy Notes: Movie Rating Analysis using PySpark & Apache Flink

## Project Overview

This project performs large-scale movie rating analysis using:

* **PySpark** for distributed batch processing
* **Apache Flink** for real-time stream processing

The goal is to extract meaningful insights such as:

* Top-rated movies
* Genre-wise rating trends
* User activity patterns
* Real-time rating updates

---

## 1. Dataset Download and Description

### Dataset Download

- Download the **MovieLens** dataset from the following website link [Click here](https://grouplens.org/datasets/movielens/latest/)

We use the **MovieLens Latest Dataset**, which contains 100,000+ ratings collected from users.

### Dataset Structure

```
ml-latest-small/
│
├── movies.csv
├── ratings.csv
├── tags.csv
├── links.csv
```

---

## File Details

### movies.csv

**Schema:**

```
movieId, title, genres
```

**Description:**

* Contains metadata about movies
* Each movie has a unique `movieId`
* Genres are pipe-separated (multi-valued)

**Example:**

```
1, Toy Story (1995), Adventure|Animation|Children|Comedy|Fantasy
```

**Usage in Project:**

* Used for joining with ratings
* Enables genre-based analysis

---

### ratings.csv ⭐ (Core Dataset)

**Schema:**

```
userId, movieId, rating, timestamp
```

**Description:**

* Contains user ratings for movies
* Each row represents a rating event

**Example:**

```
1, 31, 2.5, 1260759144
```

**Usage in Project:**

* Main dataset for analysis
* Used to compute:

  * Average ratings
  * Top-rated movies
  * User activity

---

### tags.csv 🏷️

**Schema:**

```
userId, movieId, tag, timestamp
```

**Description:**

* Contains user-generated tags for movies
* Tags represent user perception (e.g., "funny", "dark")

**Example:**

```
2, 60756, funny, 1445714994
```

**Usage in Project:**

* Optional semantic analysis
* Can be used to:

  * Identify popular tags
  * Analyze tag frequency per movie
  * Enhance recommendation insights

---

### links.csv (Optional)

**Schema:**

```
movieId, imdbId, tmdbId
```

**Description:**

* Maps MovieLens IDs to external databases

**Usage in Project:**

* Not required for core analytics
* Can be used for external integrations

---

## 2. PySpark Environment Setup and Data Loading

### Objective

The objective of this step is to initialize a PySpark environment, load the dataset into distributed DataFrames, and verify that the data is correctly structured for further processing.

---

### 2.1 Environment Requirements

Before running PySpark, ensure the following dependencies are installed:

* Python (3.x)
* Java (JDK 17 or compatible)
* PySpark

#### Installation Commands

```bash
pip install pyspark
```

Verify Java installation:

```bash
java -version
```

---

### 2.2 Project Structure

The project is organized as follows:

```
bigdata_project/
│
├── data/
│   └── ml-latest-small/
│
├── scripts/
│   └── analysis.py
```

* The dataset is stored inside the `data/` directory
* All processing scripts are placed in the `scripts/` folder

---

### 2.3 Initializing Spark Session

A Spark session is created to enable distributed data processing.

```python
from pyspark.sql import SparkSession

spark = SparkSession.builder \
    .appName("MovieLens Analysis") \
    .getOrCreate()

spark.sparkContext.setLogLevel("ERROR")
```

**Explanation:**

* `SparkSession` is the entry point for working with Spark
* `appName` assigns a name to the application
* Log level is reduced to avoid excessive console output

---

### 2.4 Loading Dataset into DataFrames

The dataset is loaded using PySpark’s CSV reader with schema inference enabled.

```python
from pathlib import Path

DATA_PATH = Path("data/ml-latest-small")

movies = spark.read.csv(str(DATA_PATH / "movies.csv"), header=True, inferSchema=True)
ratings = spark.read.csv(str(DATA_PATH / "ratings.csv"), header=True, inferSchema=True)
tags = spark.read.csv(str(DATA_PATH / "tags.csv"), header=True, inferSchema=True)
```

**Explanation:**

* `header=True` ensures column names are read correctly
* `inferSchema=True` automatically detects data types
* Each file is loaded into a separate DataFrame

---

### 2.5 Data Verification

To ensure correct loading, the first few rows of each dataset are displayed:

```python
movies.show(5)
ratings.show(5)
tags.show(5)
```

**Observed Output:**

* Movie titles and genres are correctly displayed
* Ratings include userId, movieId, and rating values
* Tags dataset contains descriptive labels

---

### 2.6 Schema Validation

Schema validation ensures correct data types for processing:

```python
movies.printSchema()
ratings.printSchema()
tags.printSchema()
```

**Key Observations:**

* `movieId` and `userId` are integers
* `rating` is a double
* `genres` and `tag` are strings

This confirms that schema inference worked correctly.

---

### 2.7 Data Size Verification

To confirm dataset completeness, row counts are checked:

```python
print("Movies count:", movies.count())
print("Ratings count:", ratings.count())
print("Tags count:", tags.count())
```

**Expected Results:**

* Movies ≈ 9700+
* Ratings ≈ 100000+
* Tags ≈ 3000+

---

### 2.8 Observations

* DataFrames were successfully created without errors
* Schema inference correctly assigned data types
* Dataset size aligns with expected values
* Spark environment is functioning correctly

---

### 2.9 Outcome of This Step

At the end of this step:

* The dataset is fully loaded into PySpark
* Data is validated and ready for processing
* The environment is configured for distributed computation

This forms the foundation for subsequent data preprocessing and analysis.

---

## 3. Data Preprocessing and Transformation

### Objective

The objective of this step is to combine multiple datasets into a unified structure, clean the data, and transform it into a format suitable for analysis.

---

### 3.1 Joining Datasets

The `ratings.csv` and `movies.csv` datasets are joined using the common key `movieId`.

```python
df = ratings.join(movies, on="movieId", how="inner")
df.show(5)
```

**Explanation:**

* The join operation merges user rating data with movie metadata
* Each record now contains both rating information and movie details
* An inner join ensures only matching records are included

**Resulting Schema:**

```
userId | movieId | rating | timestamp | title | genres
```

---

### 3.2 Handling Missing Values

To ensure data quality, null values are checked across all columns.

```python
from pyspark.sql.functions import col, sum

df.select([sum(col(c).isNull().cast("int")).alias(c) for c in df.columns]).show()
```

**Explanation:**

* This checks for missing values in each column
* Null values can lead to incorrect aggregations if not handled

If null values are present, they are removed:

```python
df = df.dropna()
```

---

### 3.3 Transforming Genre Data

The `genres` column contains multiple values in a single field, separated by the `|` symbol. This format is not suitable for analysis.

**Example (Before Transformation):**

```
Comedy|Romance
```

To normalize this, the column is split and expanded into multiple rows.

```python
from pyspark.sql.functions import split, explode

df = df.withColumn("genre", explode(split(df["genres"], "\\|")))
```

**Explanation:**

* `split()` converts the string into an array of genres
* `explode()` creates a separate row for each genre
* This enables proper grouping and aggregation

**Example (After Transformation):**

```
Movie A | Comedy  
Movie A | Romance
```

---

### 3.4 Data Validation

To verify the transformation, selected columns are displayed:

```python
df.select("title", "genre").show(10, False)
```

Additionally, the schema is checked:

```python
df.printSchema()
```

---

### 3.5 Observations

* The datasets were successfully merged using `movieId`
* No significant missing values were found (or were removed)
* The `genres` column was normalized into a new `genre` column
* The dataset is now structured for efficient aggregation

---

### 3.6 Outcome of This Step

At the end of this step:

* A unified dataset combining ratings and movie metadata is created
* Data is cleaned and free of null values
* Multi-valued genre data is transformed into an analyzable format

This processed dataset will be used for generating insights in the next stage.

---
## 4. Data Analysis and Insight Generation

### Objective

The objective of this step is to perform distributed data analysis on the processed dataset to extract meaningful insights related to movies, genres, users, and tags.

---

### 4.1 Top Rated Movies

The average rating and total number of ratings are computed for each movie.

```python
from pyspark.sql.functions import avg, count

top_movies = df.groupBy("title") \
    .agg(
        avg("rating").alias("avg_rating"),
        count("rating").alias("num_ratings")
    ) \
    .filter("num_ratings > 50") \
    .orderBy("avg_rating", ascending=False)

top_movies.show(10, False)
```

**Explanation:**

* `groupBy("title")` groups all ratings for each movie
* `avg("rating")` computes the average rating
* `count("rating")` ensures statistical significance
* Movies with very few ratings are filtered out to avoid misleading results

**Outcome:**

* Identifies the most highly rated and widely reviewed movies
* Provides reliable ranking based on sufficient data

---

### 4.2 Genre-wise Average Ratings

Average ratings are computed for each genre.

```python
genre_ratings = df.groupBy("genre") \
    .agg(avg("rating").alias("avg_rating")) \
    .orderBy("avg_rating", ascending=False)

genre_ratings.show()
```

**Explanation:**

* Uses the transformed `genre` column from preprocessing
* Aggregates ratings across all movies belonging to each genre

**Outcome:**

* Highlights user preferences across different genres
* Enables comparative analysis of genre popularity

---

### 4.3 Most Active Users

User activity is measured based on the number of ratings provided.

```python
active_users = df.groupBy("userId") \
    .agg(count("rating").alias("num_ratings")) \
    .orderBy("num_ratings", ascending=False)

active_users.show(10)
```

**Explanation:**

* Groups data by `userId`
* Counts the number of ratings per user

**Outcome:**

* Identifies highly active users
* Provides insight into user engagement patterns

---

### 4.4 Tag-Based Analysis

The `tags.csv` dataset is used to analyze commonly assigned tags.

#### Joining Tags with Movies

```python
tag_df = tags.join(movies, on="movieId", how="inner")
```

#### Computing Most Common Tags

```python
tag_counts = tag_df.groupBy("tag") \
    .agg(count("*").alias("count")) \
    .orderBy("count", ascending=False)

tag_counts.show(10, False)
```

**Explanation:**

* Tags are grouped and counted to identify frequency
* Joining with movies enables contextual understanding

**Outcome:**

* Identifies commonly used descriptive tags
* Adds a semantic layer to the analysis

---

### 4.5 Saving Output Results

The computed results are stored for reporting and visualization.

```python
top_movies.write.csv("output/top_movies", header=True)
genre_ratings.write.csv("output/genre_ratings", header=True)
active_users.write.csv("output/active_users", header=True)
tag_counts.write.csv("output/tag_counts", header=True)
```

**Explanation:**

* Results are saved as CSV files
* Enables reuse for visualization and reporting

---

### 4.6 Observations

* Distributed aggregation was successfully performed using PySpark
* Filtering ensured meaningful and reliable outputs
* Data was analyzed across multiple dimensions (movies, genres, users, tags)
* Results are structured and ready for visualization

---

### 4.7 Outcome of This Step

At the end of this step:

* Key insights have been extracted from the dataset
* Analytical results have been generated and stored
* The project demonstrates effective use of distributed data processing

These outputs form the core results of the project and will be used for presentation and evaluation.

---
## 5. Real-Time Stream Processing using Apache Flink and Kafka

### Objective

The objective of this step is to implement a real-time data processing pipeline using Apache Kafka for data ingestion and Apache Flink for stream processing. This enables continuous analysis of movie ratings as they are generated.

---

### 5.1 System Architecture

The streaming pipeline consists of the following components:

* **Kafka Producer**: Streams movie rating data (simulated or from dataset)
* **Kafka Topic**: Acts as a message queue (`movie_ratings`)
* **Apache Flink**: Consumes and processes the stream in real time

Data Flow:

Producer → Kafka Topic → Flink Consumer → Real-time Analytics Output

---

### 5.2 Kafka Setup

Kafka is used as a distributed messaging system to simulate real-time data ingestion.

#### Steps Performed:

* Zookeeper service started
* Kafka broker initialized
* Topic `movie_ratings` created

#### Purpose:

* Decouples data producers and consumers
* Enables continuous data streaming

---

### 5.3 Kafka Producer Implementation

A Python-based Kafka producer is used to send rating data.

#### Key Functionality:

* Reads data (random or from dataset)
* Sends JSON messages to Kafka topic
* Simulates streaming using time delays

#### Example Data Format:

```json
{
  "movieId": 1,
  "rating": 4.5
}
```

---

### 5.4 Flink Streaming Environment Setup

The Flink execution environment is initialized to process streaming data.

```python
env = StreamExecutionEnvironment.get_execution_environment()
env.set_parallelism(1)
```

#### External Dependencies:

Kafka connector and client libraries are added:

```python
env.add_jars(
    "flink-connector-kafka-1.17.2.jar",
    "kafka-clients-3.4.0.jar"
)
```

#### Purpose:

* Enables Flink to connect with Kafka
* Resolves required Java dependencies

---

### 5.5 Kafka Source Integration

Flink consumes data from Kafka using `KafkaSource`.

```python
source = KafkaSource.builder() \
    .set_bootstrap_servers("localhost:9092") \
    .set_topics("movie_ratings") \
    .set_group_id("flink_group") \
    .set_value_only_deserializer(SimpleStringSchema()) \
    .build()
```

#### Explanation:

* Connects Flink to Kafka broker
* Subscribes to topic `movie_ratings`
* Deserializes incoming messages as strings

---

### 5.6 Data Parsing and Transformation

Incoming JSON messages are parsed into structured tuples.

```python
class ParseData(MapFunction):
    def map(self, value):
        data = json.loads(value)
        return (data["movieId"], data["rating"])
```

#### Purpose:

* Converts raw JSON into usable format
* Prepares data for computation

---

### 5.7 Stateful Stream Processing

A running average rating is computed for each movie.

```python
class AvgRating(MapFunction):
    def __init__(self):
        self.count = {}
        self.sum = {}

    def map(self, value):
        movieId, rating = value
        self.count[movieId] += 1
        self.sum[movieId] += rating
        return (movieId, self.sum[movieId] / self.count[movieId])
```

#### Explanation:

* Maintains state (count and sum) per movie
* Updates average dynamically as new data arrives

---

### 5.8 Stream Execution

The transformations are applied and results are printed.

```python
parsed = stream.map(ParseData()).filter(lambda x: x is not None)
result = parsed.map(AvgRating())
result.print()

env.execute("Kafka Flink Streaming Job")
```

---

### 5.9 Observations

* Data is processed continuously as it arrives
* Output updates in real time
* No need to wait for full dataset processing

Example Output:

```
(1, 4.0)
(1, 3.5)
(2, 5.0)
(2, 4.75)
```

---

### 5.10 Key Concepts Demonstrated

* Stream processing vs batch processing
* Message queue (Kafka)
* Real-time analytics
* Stateful computation
* Low-latency data pipelines

---

### 5.11 Limitations

* Uses simulated or replayed data instead of true live system
* State management is implemented using local variables (not fault-tolerant)
* Does not use advanced features like windowing or checkpointing

---

### 5.12 Outcome of This Step

At the end of this step:

* A real-time streaming pipeline is successfully implemented
* Kafka is used for data ingestion
* Flink processes and analyzes data continuously
* Live insights (average ratings) are generated dynamically

This step enhances the project by introducing real-time capabilities in addition to batch processing.

---

## 6 Real-Time Movie Analytics System using Kafka and Apache Flink

## 1. Introduction

This project implements a **real-time movie analytics system** using Apache Kafka and Apache Flink. The system processes streaming movie rating data and generates multi-dimensional insights such as:

* Movie-level analytics
* Genre-based trends
* Tag-based sentiment insights
* User behavior patterns
* Time-based activity
* Trending and hot movies
* Outlier detection

Unlike traditional batch processing systems, this pipeline continuously updates analytics as new data arrives, enabling **real-time decision-making**.

---

## 2. System Architecture

### Pipeline Overview:

```
CSV Dataset → Kafka Producer → Kafka Topic → Flink Consumer → Analytics Streams → Output
```

### Components:

1. **Data Source**

   * ratings.csv (user ratings)
   * movies.csv (metadata)
   * tags.csv (user-generated tags)

2. **Kafka Producer**

   * Reads and merges datasets
   * Streams enriched JSON data

3. **Kafka Broker**

   * Stores streaming data in topic: `movie_ratings`

4. **Flink Consumer**

   * Processes stream using window-based aggregation
   * Computes multiple analytics in parallel

5. **Output**

   * Console output (for now)
   * Can be extended to frontend/dashboard

---

## 3. Data Schema

Each Kafka message contains:

```json
{
  "movieId": int,
  "rating": float,
  "userId": int,
  "timestamp": int,
  "genres": [string],
  "tags": [string]
}
```

---

## 4. Stream Processing Logic

### 4.1 Parsing Stage

* JSON messages are parsed into structured objects
* Invalid records are filtered out

---

## 5. Analytics Modules

### 5.1 Movie-Level Analytics

Calculates:

* Average rating
* Total rating count
* Weighted score

#### Formula:

```
avg = sum / count
weighted = (avg * count) / (count + 10)
```

#### Output:

```json
{
  "type": "movie",
  "movieId": 10,
  "avg": 4.2,
  "count": 50,
  "weighted": 3.8
}
```

---

### 5.2 Genre Analytics

Calculates:

* Average rating per genre
* Total number of ratings (popularity)

#### Output:

```json
{
  "type": "genre",
  "genre": "Action",
  "avg": 3.9,
  "count": 200
}
```

---

### 5.3 Tag Analytics

Analyzes user-generated tags to extract semantic insights.

#### Output:

```json
{
  "type": "tag",
  "tag": "funny",
  "avg": 4.2,
  "count": 45
}
```

---

### 5.4 User Behavior Analytics

Tracks:

* Average rating per user
* Number of ratings per user

#### Output:

```json
{
  "type": "user",
  "userId": 5,
  "avg_rating": 4.1,
  "count": 30
}
```

---

### 5.5 Time-Based Analytics

Analyzes user activity based on timestamp.

* Extracts hour of rating
* Computes average rating per hour

#### Output:

```json
{
  "type": "time",
  "hour": 21,
  "avg_rating": 4.0
}
```

---

### 5.6 Rating Distribution

Tracks frequency of ratings (1–5 stars).

#### Output:

```json
{
  "type": "distribution",
  "movieId": 10,
  "dist": {
    "1": 2,
    "2": 5,
    "3": 10,
    "4": 20,
    "5": 13
  }
}
```

---

### 5.7 Trending Movies

Detects changes in average rating over time.

#### Logic:

```
trend = current_avg - previous_avg
```

#### Output:

```json
{
  "type": "trend",
  "movieId": 10,
  "trend": 0.4
}
```

---

### 5.8 Hot Movies

Combines rating and popularity.

#### Formula:

```
score = avg × log(count + 1)
```

#### Output:

```json
{
  "type": "hot",
  "movieId": 10,
  "score": 12.5
}
```

---

### 5.9 Outlier Detection

Identifies movies significantly different from global average.

#### Logic:

```
if |movie_avg - global_avg| > threshold → outlier
```

#### Output:

```json
{
  "type": "outlier",
  "movieId": 999,
  "avg": 1.2,
  "global_avg": 3.6,
  "diff": 2.4
}
```

---

## 6. Windowing Strategy

* **Tumbling Window**
* Duration: 10 seconds
* Purpose: Batch incoming stream into manageable intervals

---

## 7. Key Features

* Real-time streaming analytics
* Multi-dimensional insights
* Scalable architecture
* Modular design
* Supports extension to frontend dashboards

---

## 8. Challenges Faced

* Handling incomplete Kafka messages
* Ensuring schema consistency between producer and consumer
* Avoiding incorrect aggregation (average of averages issue)
* Managing state in streaming environment

---

## 9. Limitations

* Uses processing time instead of event time
* Local state used for trend detection (not distributed-safe)
* No persistent storage (console output only)

---

## 10. Future Enhancements

* Integration with frontend dashboard (React)
* Use Flink managed state for scalability
* Event-time processing with watermarks
* Kafka sink for processed analytics
* Deployment on cloud (AWS / Docker)

---

## 11. Conclusion

This project demonstrates a complete real-time data pipeline capable of generating meaningful analytics from streaming data. It highlights the power of combining Kafka and Flink for building scalable, real-time systems.

The system goes beyond basic aggregation and provides deeper insights such as trends, user behavior, and anomaly detection, making it suitable for real-world analytics applications.
