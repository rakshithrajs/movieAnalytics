# 3-Minute Demo Script

## 0:00 – 0:30: Architecture Intent

- Start with pipeline: Kafka → Flink → Redis → FastAPI WebSocket → React dashboard.
- Explain why snapshot + patch protocol was chosen for resilience and low latency.

## 0:30 – 1:30: Live Data Flow

- Run producer and Flink job.
- Open dashboard and show live status indicator + sequence growth.
- Highlight trend panel and hot movie ranking updates.

## 1:30 – 2:30: Product Decisions

- Mention editorial palette and typography for readability.
- Show meaningful interactions (rank and trend coherence, no visual gimmicks).
- Explain reconnect behavior and bounded cache strategy.

## 2:30 – 3:00: Tradeoffs & Next Steps

- Current outlier/trend logic remains from Flink and can move to managed state.
- Add dedicated Redis producer sink from Flink for full end-to-end path.
- Add advanced drill-down pages after baseline stability.
