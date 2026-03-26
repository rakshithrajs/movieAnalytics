from kafka import KafkaProducer
import json
import time
import pandas as pd

producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)

ratings = pd.read_csv("data/ml-latest-small/ratings.csv")
movies = pd.read_csv("data/ml-latest-small/movies.csv")
tags = pd.read_csv("data/ml-latest-small/tags.csv")

df = ratings.merge(movies, on="movieId", how="left")

tags_grouped = tags.groupby("movieId")["tag"].apply(list).reset_index()
df = df.merge(tags_grouped, on="movieId", how="left")

for _, row in df.iterrows():
    data = {
        "movieId": int(row["movieId"]),
        "movieTitle": str(row["title"]) if pd.notna(row["title"]) else "Unknown Movie",
        "rating": float(row["rating"]),
        "userId": int(row["userId"]),
        "timestamp": int(row["timestamp"]),
        "genres": row["genres"].split("|") if pd.notna(row["genres"]) else [],
        "tags": row["tag"] if isinstance(row["tag"], list) else [],
    }

    producer.send("movie_ratings", value=data)
    print("Sent: ", data)

    time.sleep(0.05)
