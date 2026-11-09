---
title: Analysis for 200,000 meters
sidebar_position: 6
---

# Analysis: architecture, cost and storage for 200,000 meters (US-58, T-58.3)

This page answers US-58: how the architecture and the cost change when the pilot grows from 5,500 to 200,000 meters,
and how 3 years of readings are kept. It uses two other pages:

- *Costs → Scaling to 200,000 meters* (T-58.2): resources and cost extrapolated from the dev window of 8-9 November.
- *Performance → Ingestion at 200,000 meters* (T-58.1): the simulator, the queue, the consumer and `clean_readings`
  measured at the target size.

Every figure is in USD per month, `us-east-1`, on-demand, as in *Monthly estimate*, unless it says otherwise.

## Summary

- **The architecture does not need a redesign.** The changes at 200,000 meters are sizes, one job and the layout of
  the raw files. RabbitMQ handled the target load with one consumer and about 80 times of headroom, so Kafka is not
  needed (ADR-001 asked to review it at this volume).
- **Three changes are needed:**
  - `estimate_gaps` on 16 vCPU to keep the daily close under 45 minutes;
  - a larger RDS and larger API tasks;
  - the consumer writing **one compressed object per batch** instead of one object per message.
- **The raw layout drives the 3-year storage cost.** Each message is a 6.7 KB object today. That is below the 128 KB
  that S3 lifecycle rules need to move an object to a cheaper class, so raw would stay in S3 Standard for 3 years.
  At 200,000 meters that costs **1,282 USD over 3 years**. One gzip object per 50 messages brings it to **57 USD**.
- **Recommended scenario for 200,000 meters: about 282 USD per month**, 0.0014 USD per meter. With high
  availability for production it is about 479 USD.

## Architecture at 200,000 meters

| Layer | Pilot (today) | 200,000 meters | Why |
|---|---|---|---|
| Sources | 86 concentrators | 3,125 concentrators, 111 readings per second on average | 64 meters per concentrator |
| Ingestion | RabbitMQ on the shared EC2 `t3.large`, one consumer task | **Same broker and one consumer for throughput**; a second consumer for availability | The consumer stores about 8,800 readings per second (T-58.1) |
| Raw layer | One JSON object per message | **One gzip JSON-lines object per consumer batch** (50 messages) | 50 times fewer PUT, lifecycle-friendly sizes, fast reading in Spark (see below) |
| Processing | Daily close on 2 vCPU tasks, 12.2 min | `estimate_gaps` on 16 vCPU / 64 GB, the other jobs on 2-8 vCPU; about 35 min | US-55: under 45 minutes (T-58.2) |
| Storage | Lifecycle rules of T-23.2 | Same rules for clean and curated; raw stays in Standard but compressed | See the storage strategy |
| Operational database | RDS `db.t4g.small`, 20 GB | RDS `db.t4g.medium`, 50 GB (**assumed**) | 36 times more customers and daily aggregates |
| APIs | 3 tasks of 0.25 vCPU / 0.5 GB | 3 tasks of 0.5 vCPU / 1 GB (**assumed**) | Same; not load-tested at this size |
| Network | Fargate in public subnets, no NAT (ADR-011) | Same; production moves tasks to private subnets with interface endpoints | ADR-011 noted this for US-58 |

### What changes in the code

1. **Consumer** (`voltiagrid-api/ingestion`): it already ACKs in batches of 50 messages or 2 seconds. It should write
   the batch as one `.jsonl.gz` object, one message per line, before the ACK. Each message is still stored byte for
   byte as received, so raw stays append-only and reprocessable (ADR-007). The change must be recorded in a new ADR.
2. **`read_f3`** (`voltiagrid-data/jobs/readings.py`): read JSON lines (`multiLine` off). Spark reads `.gz`
   transparently. In T-58.1, the same messages were read in about 1 s from 250 files and in 145-270 s from 12,500
   files.
3. **`estimate_gaps`**: run it on 16 vCPU / 64 GB, or keep the weekday profile from one day to the next instead of
   recomputing 28 days (T-58.2).

## Cost of each scenario

| Line | A. Pilot today | B. 200,000, same layout | C. 200,000, recommended | D. 200,000, high availability |
|---|---|---|---|---|
| P1 API tasks | 27.05 | 54.10 | 54.10 | 54.10 |
| P7 Daily close | 1.07 | 13.26 | 13.26 | 13.26 |
| P8 RDS | 25.66 | 53.20 | 53.20 | 106.40 |
| P11 S3 (3-year average) | 1.38 | 36.01 | 1.98 | 1.98 |
| RabbitMQ cluster (3 × `t3.medium` + 3 × 30 GB gp3) | — | — | — | 98.30 |
| Second consumer task | — | — | — | 9.02 |
| Interface endpoints (ECR API, ECR DKR, Logs, Secrets Manager × 2 AZ) | — | — | — | 58.40 |
| P10 Public IPv4 (6 tasks move to private subnets) | — | — | — | −21.90 |
| Rest of *Monthly estimate*, unchanged | 159.73 | 159.73 | 159.73 | 159.73 |
| **Total per month** | **214.89** | **316.30** | **282.27** | **479.29** |
| Per meter per month | 0.0391 | 0.0016 | 0.0014 | 0.0024 |

How the lines are built:

- **A** and lines P1, P7, P8 of B and C come from *Scaling to 200,000 meters*.
- **P11 in B and C** is the 3-year total of the storage strategy below divided by 36 months, plus 0.40 USD of GET
  requests. B replaces the 23.48 USD of the cost page, which assumed 47 bytes per reading (F1 CSV). F3 measured
  105 bytes per reading (T-58.1).
- **D** assumes the following, with one row each in the table:
  - a dedicated RabbitMQ cluster of three nodes with quorum queues; Airflow stays on the `t3.large` of P3;
  - RDS Multi-AZ, which doubles the instance and its storage;
  - a second consumer;
  - Fargate in private subnets with the four interface endpoints in two AZs (0.01 USD per hour each), instead of a
    NAT Gateway (ADR-011).
- The preliminary 581 USD of *Logical architecture* included NAT Gateways in both zones and a larger close. D replaces
  it.

**Cost per meter drops about 96%** from the pilot to scenario C, because most of the bill is services that are always
on (EC2, ALB, IPv4, Fargate for the APIs), not data. The variable part (daily close and S3) is about 15 USD per month at
200,000 meters.

## Storage strategy for 3 years

Retention: every object expires 1,095 days after it is written (`retention_days`, T-23.2). Lifecycle rules coded in
`voltiagrid-api/infra/modules/data_lake`:

| Layer | 0-30 days | Then | Then | Read by |
|---|---|---|---|---|
| raw | Standard | Standard-IA at 30 days | Glacier Instant Retrieval at 90, Deep Archive at 365 | Reprocessing only |
| clean | Standard | Standard-IA at 30 days | Glacier Instant Retrieval at 180 | Daily close (recent days), monthly billing |
| curated | Standard | Standard-IA at 90 days | — | Power BI |

### The 128 KB limit

Since 2024, S3 lifecycle rules do not move objects smaller than 128 KB by default
(`transition_default_minimum_object_size = all_storage_classes_128K`; the state of `infra/bootstrap` shows this default,
and `infra/modules/data_lake` does not set another value). Standard-IA and Glacier Instant Retrieval also bill every object as at least 128 KB. Today raw F3
objects are 6.7 KB, so **the raw rules above never apply to them**. Every raw message would stay in Standard for 3
years.

Volume per month at 200,000 meters: raw 30.3 GB as JSON (105 bytes per reading) or 2.1 GB gzip (7.4 bytes per
reading, measured on the 12,500 messages of T-58.1); clean 1.76 GB (6.1 bytes per row, F1 history). Curated is about 4%
of clean in the local lake and is left out.

| Raw layout | Object size | Objects per month | S3 bill in month 12 | Month 24 | Month 36 | **3-year total** |
|---|---|---|---|---|---|---|
| One JSON object per message (today) | 6.7 KB | 4,500,000 | 31.05 | 39.50 | 47.95 | **1,282** |
| JSON lines, 50 messages per object | 337 KB | 90,000 | 5.89 | 10.83 | 11.28 | **315** |
| JSON lines gzip, 50 messages per object (recommended) | 23.5 KB | 90,000 | 1.23 | 1.90 | 2.56 | **57** |
| Pilot today (5,500 meters) | 6.7 KB | 123,750 | 0.85 | 1.09 | 1.32 | **35** |

The totals include PUT requests (0.005 per 1,000) and lifecycle transitions (0.01, 0.02 and 0.05 per 1,000 to IA,
Glacier Instant Retrieval and Deep Archive), as well as the storage of raw and clean. They are computed month by
month, with each month of data in the storage class that matches its age.

With gzip, raw objects are again below 128 KB and stay in Standard. That is fine: 3 years of compressed raw at
200,000 meters are about 76 GB, 1.75 USD per month in Standard. A reprocess also reads them at once, with no
12-hour restore from Deep Archive. The rules for clean and curated keep working, because their Parquet files are
larger than 128 KB.

### Recommended strategy

1. **Raw**:
   - gzip JSON lines, one object per consumer batch;
   - leave it in Standard, with the 3-year expiration;
   - keep versioning to protect the only copy of the sources.
2. **Clean**: the current rules (IA at 30 days, Glacier Instant Retrieval at 180). The daily close and monthly billing
   read only recent months.
3. **Curated**: the current rule (IA at 90 days). It is small, and Power BI reads it.
4. **Review after the first year** with S3 Storage Lens or the bill. If raw grows beyond the estimate, batch more
   messages per object (about 280 gzip messages reach 128 KB) and the raw rules apply again.

At 3 years and 200,000 meters the lake holds about 76 GB of raw, 63 GB of clean and a few GB of curated: **about
2.6 USD per month** in month 36, against 48 USD with today's layout.

## Risks and what is not measured

- **APIs and RDS at 200,000 customers** (P1, P8) are assumptions: no load test of the APIs at this size was run.
- **`estimate_gaps` on 16 vCPU** assumes that the job scales with the cores (T-58.2).
- **The consumer writing to S3** and RabbitMQ on EC2 were not measured at this load; the test wrote to a local disk.
- **Prices** are the on-demand prices of *Monthly estimate*. Savings Plans or Reserved Instances for the always-on
  part (EC2, RDS, API tasks) would lower scenarios C and D; they were not applied.
