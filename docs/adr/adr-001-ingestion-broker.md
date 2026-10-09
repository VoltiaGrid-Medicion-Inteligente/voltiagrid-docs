---
sidebar_position: 1
---

# ADR-001: RabbitMQ as the ingestion broker

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P1

## Context
Concentrators send batches of readings every 30 minutes (264,000 readings a day in the pilot). After an outage, up to 1,000 meters can resend 24 hours at once (48,000 readings). The requirement is **zero lost readings** (RNF-03) and the program requires a message broker.

## Decision
Use **RabbitMQ** with a `topic` exchange, two durable queues (live and resend), persistent messages, publisher confirms, manual ACK after the reading is stored, and a dead-letter queue. The same RabbitMQ is the Celery broker for Airflow.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Apache Kafka (or Amazon MSK) | Built for much higher throughput than the pilot needs; a cluster is more expensive and harder to operate for a 4-person team. Reviewed again at 200,000 meters (9.6 M readings a day). |
| Amazon SQS | No exchanges or routing keys, so live traffic and resends cannot be split by routing; it would also not serve as the Celery broker, adding a second service. |

## Consequences
- Queues absorb peaks without oversizing consumers; consumers scale out while the resend queue is long.
- One broker covers two needs (ingestion and Celery).
- At projected volume, queue depth and throughput must be monitored; the alarm on queue depth is the signal to revisit this ADR.