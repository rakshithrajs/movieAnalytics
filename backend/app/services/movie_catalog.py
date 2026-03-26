import csv
from pathlib import Path


class MovieCatalog:
    def __init__(self, csv_path: str):
        self._csv_path = Path(csv_path)
        self._titles_by_id: dict[int, str] = {}
        self._load()

    def _load(self) -> None:
        if not self._csv_path.exists():
            return

        with self._csv_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                try:
                    movie_id = int(row.get("movieId", ""))
                except (TypeError, ValueError):
                    continue

                title = str(row.get("title", "")).strip()
                if title:
                    self._titles_by_id[movie_id] = title

    def title_for(self, movie_id: int | str | None) -> str | None:
        if movie_id is None:
            return None
        try:
            key = int(movie_id)
        except (TypeError, ValueError):
            return None
        return self._titles_by_id.get(key)

    def enrich_event(self, event: dict) -> dict:
        payload = event.get("payload")
        if not isinstance(payload, dict):
            return event

        movie_id = payload.get("movieId")
        resolved_title = self.title_for(movie_id)
        if not resolved_title:
            return event

        current_title = str(payload.get("movieTitle", "")).strip().lower()
        if current_title in {"", "unknown movie"}:
            payload["movieTitle"] = resolved_title

        return event
