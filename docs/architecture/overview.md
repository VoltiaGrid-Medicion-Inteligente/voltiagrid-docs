---
title: Logical architecture
sidebar_position: 1
---

# Logical architecture (v1)

> **Status:** v1 reviewed by the team on 2026-10-10 (T-09.4). Runtime updated on 2026-10-23 with [ADR-014](../adr/adr-014-runtime-adjustments.md).

VoltiaGrid receives smart-meter readings every 30 minutes, cleans and completes them, assigns every interval to a tariff band, detects non-technical losses per transformer and runs demand-response events. Results are served through APIs and a Power BI dashboard, and the whole platform runs on AWS.

## Business objectives and scope

| # | Objective | How the architecture supports it |
|---|---|---|
| 1 | Bill 99% of pilot customers with actual readings by time band | Every reading is stored without loss, cleaned with documented rules (RN-01 to RN-03) and assigned to its tariff band (RN-05). |
| 2 | Identify 70% of non-technical losses at transformer level | Energy delivered per transformer (F5) is balanced against its meters every day (RN-06, RN-07). |
| 3 | Run demand-response events with measured savings | Events are triggered automatically from forecast and load, and savings are measured against a baseline (RN-08 to RN-10). |
| 4 | A platform sized and costed for 200,000 meters | Same architecture for pilot and target; only task counts and sizes change. |

**Out of scope:** remote disconnection and reconnection, bill issuance, and machine-learning demand forecasting.

## What each area receives

| Area | Deliverable |
|---|---|
| Billing | Monthly consumption per customer and time band, with the % of estimated readings visible |
| Control center | Load per transformer and overload alerts, updated every 30 minutes |
| Losses department | Prioritized list of suspicious transformers and meters to inspect first |
| Residential customers | Their own daily consumption and event participation (they only see their own data) |
| Regulator | Quarterly report on losses and metering quality |
| Management | Power BI dashboard answering six business questions, reconciled with control queries |

## Sizing

| Scenario | Meters | Readings per day (48 per meter) |
|---|---|---|
| Pilot | 5,500 | 264,000 |
| Projected (next year) | 200,000 | 9,600,000 |
| Bulk resend after a 24 h outage | 1,000 | 48,000 at once |

The architecture is sized for the pilot and must scale to the projected volume without a redesign (36 times more readings).

| Cost indicator | Pilot | Target |
|---|---|---|
| Estimated monthly AWS cost (USD) | $219 | $581 (preliminary) |
| Cost per meter per month (USD) | $0.040 | $0.0029 |

36 times more meters for about 2.7 times the cost; cost per meter drops by about 93%, because the bill is driven by services that are always on, not by data volume. The pilot figure is the line-by-line estimate in [Costs → Monthly estimate](../costs/estimate.md). The target figure is the projection shown in the architecture presentation: RabbitMQ on a dedicated three-node cluster, RDS Multi-AZ on a larger instance, more API and consumer tasks, NAT Gateways in both zones and a daily close twice as large. It is recalculated in US-58.

## Logical diagram

The diagram reads left to right. Each box is a logical layer; the technology used in v1 is shown inside it.

```mermaid
flowchart LR
  subgraph SRC["1. Sources"]
    direction TB
    F1["F1 / F2 · London meters + weather (CSV)"]
    F3["F3 · Concentrator simulator (30 min)"]
    F5["F5 · Transformer metering API (15 min)"]
    F6["F6 · Open-Meteo forecast (hourly)"]
    F7["F7 · Tariff calendar CSV (quarterly)"]
    F4["F4 · Network inventory (seed)"]
  end

  subgraph ING["2. Ingestion"]
    direction TB
    RMQ["RabbitMQ on EC2<br/>durable queues + DLQ"]
    CON["Consumers<br/>manual ACK"]
    PULL["Pull jobs"]
    RMQ --> CON
  end

  RAW[("4. S3 lake · raw layer<br/>as received")]

  subgraph PRO["3. Processing"]
    direction TB
    AF["Airflow on EC2<br/>CeleryExecutor"]
    SPK["Spark on ECS Fargate<br/>clean · dedup · estimate<br/>bands · losses · events"]
    AF -.->|schedules| SPK
  end

  subgraph STO["4. Storage"]
    direction TB
    CUR[("S3 lake · clean + curated layers<br/>Parquet")]
    RDS[("RDS PostgreSQL<br/>inventory + aggregates")]
  end

  subgraph OUT["5. APIs · 6. Analytics"]
    direction TB
    APIC["Customer API<br/>FastAPI + JWT"]
    APICC["Control center API<br/>FastAPI + JWT"]
    PBI["Dimensional model<br/>+ Power BI"]
  end

  F3 --> RMQ
  F5 --> PULL
  F6 --> PULL
  F7 --> PULL
  CON --> RAW
  PULL --> RAW
  F1 --> RAW
  RAW --> SPK
  F4 --> RDS
  SPK --> CUR
  SPK <--> RDS
  RDS --> APIC
  RDS --> APICC
  CUR --> PBI
```

**7. Operations** is cross-cutting and applies to every layer above: GitHub Actions (lint, tests, secret scanning, image build), ECR, IAM with least privilege, VPC, resource tags, and CloudWatch logs, metrics and alarms.

## Layers

| # | Layer | What it does | v1 technology | Repository |
|---|---|---|---|---|
| 1 | **Sources** | Produce the data. F1, F2 and F6 are real; F3, F4, F5 and F7 are simulated by a reproducible seed. | CSV (Kaggle), Open-Meteo, Python simulators | `voltiagrid-api` |
| 2 | **Ingestion** | Receive readings without losing any, and bring the other sources into the lake. | RabbitMQ on one EC2 instance shared with Airflow (persistent messages, manual ACK, DLQ), consumers on ECS Fargate, pull jobs | `voltiagrid-api` |
| 3 | **Processing** | Clean, deduplicate, estimate gaps, assign tariff bands, compute losses and settle demand-response events. | Spark on ECS Fargate (on-demand; Spot only for the historical load), orchestrated by Airflow | `voltiagrid-data` |
| 4 | **Storage** | Keep every reading for 3 years at the lowest cost, plus the operational data the APIs need. | S3 (raw, clean, curated) in Parquet; RDS PostgreSQL | `voltiagrid-data`, `voltiagrid-api` |
| 5 | **APIs** | Serve daily consumption to the authenticated customer and transformer load to the control center. | FastAPI, JWT, behind an ALB | `voltiagrid-api` |
| 6 | **Analytics** | Answer the six business questions with numbers that reconcile with a control query. | Dimensional model, Power BI | `voltiagrid-analytics` |
| 7 | **Operations** | Build, deploy, secure and observe everything. | Terraform, GitHub Actions, ECR, ECS, EKS (F5 simulator only), IAM, CloudWatch | all |

## Design principles

- **Never lose a reading.** Messages are persistent and the consumer acknowledges only after the reading is stored (RNF-03).
- **Keep raw data untouched.** Business duplicates and defects are fixed in Spark, not at ingestion, so any period can be reprocessed.
- **Idempotent everything.** Re-running the seed, a Spark job or a reprocess never duplicates or corrupts data.
- **Same code everywhere.** Local and AWS differ only in environment variables (`DATABASE_URL`, bucket names).
- **No secrets in code or images.** Configuration through environment variables; CI fails if a secret is detected (CT-02).
- **Pay for what runs.** Batch work runs on Fargate tasks that stop when the job ends.

## Related pages

- [Components and data flows](./components-and-flows.md)
- [Architecture decision records](../adr/index.md)