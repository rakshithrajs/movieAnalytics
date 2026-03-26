from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Movie Analytics Streaming API"
    environment: str = "dev"

    host: str = "0.0.0.0"
    port: int = 8000

    redis_url: str = "redis://localhost:6379/0"
    redis_stream_key: str = "analytics:stream"
    redis_consumer_block_ms: int = 100
    movie_catalog_path: str = "../data/ml-latest-small/movies.csv"

    max_cache_items_per_type: int = 1000
    heartbeat_seconds: int = 30

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
