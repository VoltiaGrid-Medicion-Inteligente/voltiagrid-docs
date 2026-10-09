---
sidebar_position: 4
---

# ADR-004: Airflow with CeleryExecutor for orchestration

- **Status:** Accepted
- **Date:** 2026-10-09
- **Owner:** P3

## Context
Processes run every 15 and 30 minutes, hourly, daily, monthly and on demand, with dependencies between them and retries on failure. The daily close has a 45-minute limit that must be monitored.

## Decision
Use **Apache Airflow** with **CeleryExecutor**, using RabbitMQ as the Celery broker, so tasks are distributed across several workers. DAGs live in `voltiagrid-data` and are validated in CI.

## Alternatives considered
| Alternative | Why it was discarded |
|---|---|
| Amazon MWAA (managed Airflow) | Same Airflow without operating it, but the smallest environment has a fixed monthly cost that is high for the pilot budget. |
| Cron or EventBridge + Step Functions | Fine for simple schedules, but dependencies, retries, backfills and a run history would have to be built by hand. |

## Consequences
- One place to see every process, its retries and its duration.
- The team operates Airflow (scheduler, webserver, workers) itself.
- DAG validation is added to the data CI pipeline.